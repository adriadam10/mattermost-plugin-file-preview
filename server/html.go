package main

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// Bigger pages are not worth rendering inline; the user can still download them.
const maxHTMLBytes = 10 * 1024 * 1024

// Attached pages run their own scripts (most of them load a CDN library), so they cannot
// be shown in a srcdoc iframe: it inherits Mattermost's "script-src 'self'". Serving them
// from here with a CSP sandbox gives them an opaque origin instead: scripts run, but they
// cannot read the Mattermost session, its cookies or call its API as the viewer.
const htmlPolicy = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads; " +
	"frame-ancestors 'self'"

func (p *Plugin) newRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /html/{file_id}", p.handleHTML)
	return requireUser(mux)
}

func requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Mattermost-User-Id") == "" {
			http.Error(w, "not authorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isHTML(extension string) bool {
	ext := strings.ToLower(extension)
	return ext == "html" || ext == "htm"
}

func (p *Plugin) handleHTML(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	info, appErr := p.API.GetFileInfo(r.PathValue("file_id"))
	// Same answer for a missing file and someone else's, so ids cannot be probed.
	if appErr != nil || info.DeleteAt != 0 || !p.canRead(userID, info) {
		http.NotFound(w, r)
		return
	}
	if !isHTML(info.Extension) {
		http.Error(w, "not an HTML file", http.StatusBadRequest)
		return
	}
	if info.Size > maxHTMLBytes {
		http.Error(w, "file too big to preview", http.StatusRequestEntityTooLarge)
		return
	}
	content, appErr := p.API.GetFile(info.Id)
	if appErr != nil {
		p.API.LogError("Cannot read file", "file_id", info.Id, "error", appErr.Error())
		http.Error(w, "cannot read file", http.StatusInternalServerError)
		return
	}
	writeSandboxedHTML(w, content)
}

// canRead mirrors Mattermost's own check for downloading a file: read access to the
// channel it was posted in.
func (p *Plugin) canRead(userID string, info *model.FileInfo) bool {
	if info.CreatorId == userID {
		return true
	}
	channelID := info.ChannelId
	if channelID == "" && info.PostId != "" {
		post, appErr := p.API.GetPost(info.PostId)
		if appErr != nil {
			return false
		}
		channelID = post.ChannelId
	}
	return channelID != "" && p.API.HasPermissionToChannel(userID, channelID, model.PermissionReadChannelContent)
}

func writeSandboxedHTML(w http.ResponseWriter, content []byte) {
	h := w.Header()
	// No charset: the page's own <meta charset> decides, as when it is opened from disk.
	h.Set("Content-Type", "text/html")
	h.Set("Content-Security-Policy", htmlPolicy)
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Cache-Control", "private, max-age=300")
	_, _ = w.Write(content)
}
