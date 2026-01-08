export default {
  title: 'Dragon-UI',
  description: 'Claude Code Max Usage Dashboard - Complete Documentation',
  themeConfig: {
    logo: '/dragon-logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'API', link: '/api/' },
      { text: 'Widgets', link: '/widgets/' }
    ],
    sidebar: {
      '/guide/': [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Configuration', link: '/guide/configuration' },
        { text: 'Accounts', link: '/guide/accounts' },
        { text: 'Statusline', link: '/guide/statusline' }
      ],
      '/cli/': [
        { text: 'Overview', link: '/cli/' },
        { text: 'Commands', link: '/cli/commands' },
        { text: 'Options', link: '/cli/options' },
        { text: 'Widgets', link: '/cli/widgets' },
        { text: 'Powerline', link: '/cli/powerline' }
      ],
      '/api/': [
        { text: 'Core Data', link: '/api/core-data' },
        { text: 'Database', link: '/api/database' },
        { text: 'Pricing', link: '/api/pricing' },
        { text: 'OAuth', link: '/api/oauth' }
      ],
      '/widgets/': [
        { text: 'Overview', link: '/widgets/' },
        { text: 'Token Widgets', link: '/widgets/tokens' },
        { text: 'Git Widgets', link: '/widgets/git' },
        { text: 'System Widgets', link: '/widgets/system' },
        { text: 'Custom Widgets', link: '/widgets/custom' }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/kingchenc/Dragon-UI' }
    ],
    footer: { message: 'Released under the MIT License.', copyright: 'Copyright 2024-present Dragon-UI' },
    search: { provider: 'local' }
  }
};