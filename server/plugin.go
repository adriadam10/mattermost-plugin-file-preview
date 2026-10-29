package main

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	router http.Handler
}

func (p *Plugin) OnActivate() error {
	p.router = p.newRouter()
	return nil
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}

func main() {
	plugin.ClientMain(&Plugin{})
}
