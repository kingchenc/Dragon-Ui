'use strict';
var POWERLINE_THEMES = {
  "dracula": {
    "name": "Dracula",
    "description": "Dark purple theme",
    "colors": {
      "bg1": "#282a36",
      "bg2": "#44475a",
      "bg3": "#6272a4",
      "fg1": "#f8f8f2",
      "fg2": "#bd93f9",
      "accent1": "#ff79c6",
      "accent2": "#50fa7b",
      "accent3": "#ffb86c",
      "accent4": "#8be9fd"
    }
  },
  "catppuccin": {
    "name": "Catppuccin",
    "description": "Soothing pastel theme",
    "colors": {
      "bg1": "#1e1e2e",
      "bg2": "#313244",
      "bg3": "#45475a",
      "fg1": "#cdd6f4",
      "fg2": "#bac2de",
      "accent1": "#cba6f7",
      "accent2": "#a6e3a1",
      "accent3": "#fab387",
      "accent4": "#89b4fa"
    }
  },
  "gruvbox": {
    "name": "Gruvbox",
    "description": "Retro groove colors",
    "colors": {
      "bg1": "#282828",
      "bg2": "#3c3836",
      "bg3": "#504945",
      "fg1": "#ebdbb2",
      "fg2": "#d5c4a1",
      "accent1": "#fb4934",
      "accent2": "#b8bb26",
      "accent3": "#fabd2f",
      "accent4": "#83a598"
    }
  },
  "onedark": {
    "name": "One Dark",
    "description": "Atom-inspired dark theme",
    "colors": {
      "bg1": "#282c34",
      "bg2": "#3e4451",
      "bg3": "#4b5263",
      "fg1": "#abb2bf",
      "fg2": "#98c379",
      "accent1": "#e06c75",
      "accent2": "#98c379",
      "accent3": "#e5c07b",
      "accent4": "#61afef"
    }
  },
  "tokyonight": {
    "name": "Tokyo Night",
    "description": "Tokyo nightlife aesthetic",
    "colors": {
      "bg1": "#1a1b26",
      "bg2": "#24283b",
      "bg3": "#414868",
      "fg1": "#c0caf5",
      "fg2": "#a9b1d6",
      "accent1": "#f7768e",
      "accent2": "#9ece6a",
      "accent3": "#e0af68",
      "accent4": "#7aa2f7"
    }
  },
  "rosepine": {
    "name": "Rose Pine",
    "description": "All natural pine vibes",
    "colors": {
      "bg1": "#191724",
      "bg2": "#1f1d2e",
      "bg3": "#26233a",
      "fg1": "#e0def4",
      "fg2": "#908caa",
      "accent1": "#eb6f92",
      "accent2": "#31748f",
      "accent3": "#f6c177",
      "accent4": "#c4a7e7"
    }
  },
  "everforest": {
    "name": "Everforest",
    "description": "Comfortable green theme",
    "colors": {
      "bg1": "#2d353b",
      "bg2": "#343f44",
      "bg3": "#475258",
      "fg1": "#d3c6aa",
      "fg2": "#9da9a0",
      "accent1": "#e67e80",
      "accent2": "#a7c080",
      "accent3": "#dbbc7f",
      "accent4": "#7fbbb3"
    }
  },
  "kanagawa": {
    "name": "Kanagawa",
    "description": "Japanese aesthetics",
    "colors": {
      "bg1": "#1f1f28",
      "bg2": "#2a2a37",
      "bg3": "#363646",
      "fg1": "#dcd7ba",
      "fg2": "#c8c093",
      "accent1": "#c34043",
      "accent2": "#76946a",
      "accent3": "#c0a36e",
      "accent4": "#7e9cd8"
    }
  },
  "nightfox": {
    "name": "Nightfox",
    "description": "Dark blue vibrant theme",
    "colors": {
      "bg1": "#192330",
      "bg2": "#212e3f",
      "bg3": "#29394f",
      "fg1": "#cdcecf",
      "fg2": "#aeafb0",
      "accent1": "#c94f6d",
      "accent2": "#81b29a",
      "accent3": "#dbc074",
      "accent4": "#719cd6"
    }
  },
  "synthwave": {
    "name": "Synthwave",
    "description": "80s neon aesthetics",
    "colors": {
      "bg1": "#241b2f",
      "bg2": "#2a2139",
      "bg3": "#34294f",
      "fg1": "#ff7edb",
      "fg2": "#36f9f6",
      "accent1": "#fe4450",
      "accent2": "#72f1b8",
      "accent3": "#fede5d",
      "accent4": "#f97e72"
    }
  }
};

var BASE_THEMES = {
  nord: { name: "Nord", description: "Arctic blue palette", colors: { bg1: "#2e3440", bg2: "#3b4252", fg1: "#eceff4", accent1: "#bf616a", accent2: "#a3be8c" }},
  monokai: { name: "Monokai", description: "Classic dark vibrant", colors: { bg1: "#272822", bg2: "#3e3d32", fg1: "#f8f8f2", accent1: "#f92672", accent2: "#a6e22e" }},
  minimal: { name: "Minimal", description: "Clean monochrome", colors: { bg1: "#1a1a1a", bg2: "#2a2a2a", fg1: "#ffffff", accent1: "#ffffff", accent2: "#ffffff" }}
};

var ALL_THEMES = Object.assign({}, BASE_THEMES, POWERLINE_THEMES);

function ThemeRegistry() { this.themes = Object.assign({}, ALL_THEMES); this.custom = {}; }
ThemeRegistry.prototype.get = function(n) { return this.custom[n] || this.themes[n]; };
ThemeRegistry.prototype.list = function() { var t = this.themes; return Object.keys(t).map(function(k) { return { id: k, name: t[k].name, description: t[k].description }; }); };
ThemeRegistry.prototype.register = function(id, theme) { this.custom[id] = theme; };
ThemeRegistry.prototype.remove = function(id) { delete this.custom[id]; };
ThemeRegistry.prototype.export = function(id) { return JSON.stringify(this.get(id), null, 2); };

var _reg = null;
function getThemeRegistry() { if (!_reg) _reg = new ThemeRegistry(); return _reg; }

module.exports = { POWERLINE_THEMES: POWERLINE_THEMES, BASE_THEMES: BASE_THEMES, ALL_THEMES: ALL_THEMES, ThemeRegistry: ThemeRegistry, getThemeRegistry: getThemeRegistry };
