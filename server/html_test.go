package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

const (
	owner    = "owner"
	member   = "member"
	outsider = "outsider"
	channel  = "channel"
)

func newTestPlugin(files map[string]*model.FileInfo) *Plugin {
	api := &plugintest.API{}
	for id, info := range files {
		api.On("GetFileInfo", id).Return(info, nil)
		api.On("GetFile", id).Return([]byte("<p>hola</p>"), nil)
	}
	api.On("GetFileInfo", "missing").Return(nil, model.NewAppError("GetFileInfo", "not_found", nil, "", http.StatusNotFound))
	api.On("HasPermissionToChannel", member, channel, model.PermissionReadChannelContent).Return(true)
	api.On("HasPermissionToChannel", outsider, channel, model.PermissionReadChannelContent).Return(false)

	p := &Plugin{}
	p.SetAPI(api)
	p.router = p.newRouter()
	return p
}

func get(p *Plugin, userID, path string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, path, nil)
	if userID != "" {
		r.Header.Set("Mattermost-User-Id", userID)
	}
	w := httptest.NewRecorder()
	p.router.ServeHTTP(w, r)
	return w
}

func TestHandleHTML(t *testing.T) {
	p := newTestPlugin(map[string]*model.FileInfo{
		"page":    {Id: "page", CreatorId: owner, ChannelId: channel, Extension: "HTML", Size: 11},
		"deleted": {Id: "deleted", CreatorId: owner, ChannelId: channel, Extension: "html", DeleteAt: 1},
		"sheet":   {Id: "sheet", CreatorId: owner, ChannelId: channel, Extension: "csv"},
		"huge":    {Id: "huge", CreatorId: owner, ChannelId: channel, Extension: "htm", Size: maxHTMLBytes + 1},
	})
	cases := map[string]struct {
		user, path string
		want       int
	}{
		"anonymous":           {"", "/html/page", http.StatusUnauthorized},
		"channel member":      {member, "/html/page", http.StatusOK},
		"uploader":            {owner, "/html/page", http.StatusOK},
		"not in the channel":  {outsider, "/html/page", http.StatusNotFound},
		"missing file":        {member, "/html/missing", http.StatusNotFound},
		"deleted file":        {member, "/html/deleted", http.StatusNotFound},
		"not an HTML file":    {member, "/html/sheet", http.StatusBadRequest},
		"too big":             {member, "/html/huge", http.StatusRequestEntityTooLarge},
		"other methods/paths": {member, "/zip/page", http.StatusNotFound},
	}
	for name, c := range cases {
		if got := get(p, c.user, c.path).Code; got != c.want {
			t.Errorf("%s: status %d, want %d", name, got, c.want)
		}
	}
}

func TestHTMLIsSandboxed(t *testing.T) {
	p := newTestPlugin(map[string]*model.FileInfo{
		"page": {Id: "page", CreatorId: owner, ChannelId: channel, Extension: "html", Size: 11},
	})
	w := get(p, member, "/html/page")
	if csp := w.Header().Get("Content-Security-Policy"); csp != htmlPolicy {
		t.Errorf("CSP %q", csp)
	}
	if w.Body.String() != "<p>hola</p>" {
		t.Errorf("body %q", w.Body.String())
	}
}
