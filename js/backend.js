/*
  backend.js — connects the church website to Supabase.

  The page talks to a small set of services (database, current user, file uploads, downloads)
  through window.claude.use(name). This file provides those services using Supabase:
    - "db"        church content (settings, preachings, announcements, events, photos) with live updates
    - "user"      whether the person viewing is a logged-in editor (the pastor or helpers)
    - "assets"    uploads of photos, audio and PDFs to Supabase Storage (editors only)
    - "downloads" saving the QR code and printable card
  It also exposes window.TGGC_BACKEND for the login screen.
*/
(function () {
  "use strict";
  var cfg = window.TGGC_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) && window.supabase && window.supabase.createClient);

  // Downloads work the same with or without Supabase.
  var downloads = {
    save: function (req) {
      return new Promise(function (resolve, reject) {
        try {
          var data = req.data;
          var blob = data instanceof Blob ? data : new Blob([data]);
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = req.filename || "download";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
          resolve({ status: "saved" });
        } catch (e) { reject({ code: "unavailable", message: String(e && e.message || e) }); }
      });
    }
  };

  if (!configured) {
    window.TGGC_BACKEND = { configured: false };
    window.claude = { use: function (name) { return Promise.resolve(name === "downloads" ? downloads : null); } };
    return;
  }

  var base = cfg.SUPABASE_URL.replace(/\/+$/, "");
  var sb = window.supabase.createClient(base, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.MEDIA_BASE = base + "/storage/v1/object/public/media/";

  /* ---------- helpers ---------- */
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function split(path) { var p = path.split("/"); return { collection: p.slice(0, -1).join("/"), id: p[p.length - 1] }; }
  function snapDoc(id, data) {
    return { id: id, exists: !!data, data: function () { return data || undefined; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function mapErr(error) {
    var msg = (error && error.message) || "Something went wrong.";
    if (error && (error.code === "42501" || /row-level security|permission|not authorized|unauthorized|jwt/i.test(msg))) {
      return { code: "invalid_argument", message: "You need to be logged in as an editor to do that." };
    }
    if (/payload too large|exceeded the maximum allowed size|too large/i.test(msg)) return { code: "quota_exceeded", message: "That file is too large. The limit is 50 MB per file." };
    if (/quota|storage limit|exceed/i.test(msg)) return { code: "quota_exceeded", message: "The church's free storage is full. Delete some old photos or audio, then try again." };
    if (/fetch|network|failed to/i.test(msg)) return { code: "unavailable", message: "Couldn't reach the church database. Check your internet connection and try again." };
    return { code: "unavailable", message: msg };
  }

  /* ---------- live updates ---------- */
  var listeners = new Set();
  var channel = null;
  function ensureChannel() {
    if (channel) return;
    channel = sb.channel("tggc-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, function (payload) {
        var row = (payload.new && payload.new.path) ? payload.new : payload.old;
        listeners.forEach(function (l) {
          if (!row || !row.path || (l.type === "col" && l.key === row.collection) || (l.type === "doc" && l.key === row.path)) l.refresh();
        });
      })
      .subscribe();
  }
  function kick(collection, path) {
    listeners.forEach(function (l) { if ((l.type === "col" && l.key === collection) || (l.type === "doc" && l.key === path)) l.refresh(); });
  }
  // Safety net: refresh every 2 minutes while the page is visible, and when the visitor comes back to the tab.
  setInterval(function () { if (!document.hidden) listeners.forEach(function (l) { l.refresh(); }); }, 120000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) listeners.forEach(function (l) { l.refresh(); }); });

  function subscribe(type, key, fetcher, deliver, onError) {
    var alive = true, first = true, running = false, again = false;
    var refresh = function () {
      if (!alive) return;
      if (running) { again = true; return; }
      running = true;
      fetcher().then(function (res) {
        running = false;
        if (!alive) return;
        if (res.error) {
          if (first) { first = false; if (onError) onError(mapErr(res.error)); }
        } else { first = false; deliver(res.data); }
        if (again) { again = false; refresh(); }
      }, function (e) {
        running = false;
        if (first && alive) { first = false; if (onError) onError(mapErr(e)); }
      });
    };
    var l = { type: type, key: key, refresh: refresh };
    listeners.add(l); ensureChannel(); refresh();
    return function () { alive = false; listeners.delete(l); };
  }

  /* ---------- db ---------- */
  function makeDoc(path) {
    var s = split(path);
    var ref = {
      id: s.id, path: path,
      get: function () {
        return sb.from("docs").select("data").eq("path", path).maybeSingle().then(function (r) {
          if (r.error) throw mapErr(r.error);
          return snapDoc(s.id, r.data && r.data.data);
        });
      },
      set: function (body) {
        return sb.from("docs").upsert({ path: path, collection: s.collection, id: s.id, data: body, updated_at: new Date().toISOString() }).then(function (r) {
          if (r.error) throw mapErr(r.error);
          kick(s.collection, path);
        });
      },
      update: function (body) {
        return ref.get().then(function (cur) {
          if (!cur.exists) throw { code: "invalid_argument", message: "That item no longer exists." };
          return ref.set(Object.assign({}, cur.data(), body));
        });
      },
      delete: function () {
        return sb.from("docs").delete().eq("path", path).then(function (r) {
          if (r.error) throw mapErr(r.error);
          kick(s.collection, path);
        });
      },
      onSnapshot: function (next, error) {
        return subscribe("doc", path,
          function () { return sb.from("docs").select("data").eq("path", path).maybeSingle(); },
          function (row) { next(snapDoc(s.id, row && row.data)); }, error);
      },
      collection: function (sub) { return makeCollection(path + "/" + sub); }
    };
    return ref;
  }
  function makeCollection(collection) {
    var fetchAll = function () { return sb.from("docs").select("id,data").eq("collection", collection).order("id").limit(1000); };
    var toSnap = function (rows) {
      var docs = (rows || []).map(function (r) { return snapDoc(r.id, r.data); });
      return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      path: collection,
      doc: function (id) { return makeDoc(collection + "/" + (id || newId())); },
      add: function (data) { var d = makeDoc(collection + "/" + newId()); return d.set(data).then(function () { return d; }); },
      get: function () { return fetchAll().then(function (r) { if (r.error) throw mapErr(r.error); return toSnap(r.data); }); },
      onSnapshot: function (next, error) { return subscribe("col", collection, fetchAll, function (rows) { next(toSnap(rows)); }, error); }
    };
  }
  var db = { doc: makeDoc, collection: makeCollection };

  /* ---------- user ---------- */
  var session = null, editor = null;
  var ready = sb.auth.getSession().then(function (r) { session = r.data && r.data.session; return checkEditor(); }, function () { session = null; });
  function checkEditor() {
    if (!session) { editor = false; return false; }
    return sb.rpc("is_editor").then(function (r) { editor = !r.error && r.data === true; return editor; }, function () { editor = false; return false; });
  }
  sb.auth.onAuthStateChange(function (_event, s) { session = s; });
  var user = {
    isOwner: function () { return ready.then(function () { return !!editor; }); },
    canEdit: function () { return ready.then(function () { return !!editor; }); },
    can: function () { return ready.then(function () { return !!editor; }); },
    id: function () { return ready.then(function () { return session ? session.user.id : null; }); },
    me: function () { return ready.then(function () { return { id: session ? session.user.id : null, name: "", email: session ? session.user.email : "" }; }); },
    email: function () { return session ? session.user.email : ""; }
  };

  /* ---------- uploads ---------- */
  var EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/aac": ".aac", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg", "application/pdf": ".pdf", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-m4v": ".m4v", "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx", "application/vnd.ms-powerpoint": ".ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx", "application/vnd.ms-excel": ".xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx", "text/plain": ".txt", "text/csv": ".csv", "application/zip": ".zip", "image/heic": ".heic" };
  function extFor(blob) {
    if (EXT[blob.type]) return EXT[blob.type];
    var m = /\.([a-z0-9]{2,5})$/i.exec(blob.name || "");
    return m ? "." + m[1].toLowerCase() : "";
  }
  var assets = {
    upload: function (blob) {
      var name = "m-" + newId() + extFor(blob);
      return sb.storage.from("media").upload(name, blob, { contentType: blob.type || undefined, upsert: false, cacheControl: "31536000" }).then(function (r) {
        if (r.error) throw mapErr(r.error);
        return { id: name, url: window.MEDIA_BASE + name, sizeBytes: blob.size, contentType: blob.type };
      });
    },
    list: function () {
      return sb.storage.from("media").list("", { limit: 1000 }).then(function (r) {
        if (r.error) throw mapErr(r.error);
        return { assets: (r.data || []).map(function (f) { return { id: f.name, url: window.MEDIA_BASE + f.name, sizeBytes: f.metadata && f.metadata.size }; }), usage: null };
      });
    },
    delete: function (id) { return sb.storage.from("media").remove([id]).then(function (r) { if (r.error) throw mapErr(r.error); }); }
  };

  window.claude = {
    use: function (name) {
      if (name === "db") return Promise.resolve(db);
      if (name === "user") return Promise.resolve(user);
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "assets") return ready.then(function () { return editor ? assets : null; });
      return Promise.resolve(null);
    }
  };

  window.TGGC_BACKEND = {
    configured: true,
    signIn: function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        if (r.error) throw new Error(/invalid login|invalid credentials/i.test(r.error.message) ? "That email and password don't match. Check them and try again." : /not confirmed/i.test(r.error.message) ? "This email hasn't been confirmed yet. In Supabase, open Authentication → Users and confirm it." : r.error.message);
        session = r.data.session;
        return checkEditor().then(function (ok) {
          if (!ok) return sb.auth.signOut().then(function () { throw new Error("This account isn't on the church's editor list yet. Add its email to the editors table in Supabase."); });
          return true;
        });
      });
    },
    signOut: function () { return sb.auth.signOut(); },
    resetPassword: function (email) {
      return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#reset" }).then(function (r) { if (r.error) throw new Error(r.error.message); });
    },
    updatePassword: function (password) {
      return sb.auth.updateUser({ password: password }).then(function (r) { if (r.error) throw new Error(r.error.message); });
    },
    onRecovery: function (fn) { sb.auth.onAuthStateChange(function (event) { if (event === "PASSWORD_RECOVERY") fn(); }); },
    email: function () { return session ? session.user.email : ""; }
  };
})();
