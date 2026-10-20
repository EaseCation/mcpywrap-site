// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [
    starlight({
      title: 'mcpywrap',
      description: '用 Python 标准项目与依赖管理方式开发《我的世界》中国版 Mod 和资源包。',
      defaultLocale: 'root',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      logo: { src: './src/assets/mcpy-icon.svg', alt: 'mcpywrap' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/EaseCation/mcpywrap' }],
      customCss: ['./src/styles/tokens.css', './src/styles/starlight.css'],
      components: {
        // 品牌只有深色主题
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        ThemeSelect: './src/components/starlight/Empty.astro',
      },
      sidebar: [
        { label: '概览', link: '/wiki/' },
        { label: '入门', items: [{ autogenerate: { directory: 'wiki/start' } }] },
        { label: '项目与依赖', items: [{ autogenerate: { directory: 'wiki/project' } }] },
        { label: '本地测试', items: [{ autogenerate: { directory: 'wiki/local' } }] },
        {
          label: '运行时与 AI',
          items: [{ autogenerate: { directory: 'wiki/runtime' } }, { label: 'AI 接入', link: '/wiki/ai/' }],
        },
        { label: '联机与远程', items: [{ autogenerate: { directory: 'wiki/network' } }] },
        { label: '参考', items: [{ autogenerate: { directory: 'wiki/reference' } }] },
      ],
    }),
    react(),
  ],
});
