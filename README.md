# 🧧 春节模拟器（Spring Festival Simulator）

一个以中国春节为背景的漫画风格文字冒险游戏。选择角色、做出抉择，管理你的“存款/体重/面子/心情/健康/运气”，在 9 天假期中解锁不同结局与成就。

---

## 简介
- 原生 Web 项目（HTML/CSS/JS），无需任何打包工具即可运行
- Tailwind CSS（CDN）与 Google Fonts 提供视觉与字体支持
- 本地存档与设置保存在浏览器 localStorage

---

## 快速开始
推荐使用本地静态服务器：

```bash
# Python
python3 -m http.server 8020
# 访问 http://localhost:8020/src/index.html

# 或 Node
npx serve .
# 访问根目录或 src/index.html
```

直接打开根目录 index.html 可能因浏览器跨域策略导致 data/ 下 JSON 无法加载，建议使用本地服务器。

---

## 项目结构
```
Kimi_Agent_Final/
├── .github/workflows/deploy.yml     # GitHub Pages 自动部署
├── data/                            # 游戏数据（可编辑）
│   ├── characters.json              # 角色数据
│   ├── common_events.json           # 通用事件
│   ├── character_events.json        # 角色专属事件
│   ├── endings.json                 # 结局数据
│   └── achievements.json            # 成就数据
├── images/                          # 图像资源（角色头像/节日日历）
├── src/
│   ├── index.html                   # 主页面与 UI 布局
│   ├── styles.css                   # 样式与动画
│   └── game.js                      # 核心逻辑与渲染
├── .gitignore                       # 忽略 .DS_Store
├── index.html                       # 根目录跳转页
├── LICENSE                          # 许可证
├── README.md                        # 项目说明（本文件）
└── 项目维护.md                      # 面向维护者的数据修改指南
```

---

## 🌐 部署说明

### GitHub Pages 部署

项目已配置 GitHub Actions 自动部署工作流：

1. **Fork 本项目** 到你的 GitHub 账号
2. **启用 GitHub Pages**：
   - 进入仓库 Settings → Pages
   - Source 选择 "GitHub Actions"
3. **推送代码** 到 `main` 分支
4. 工作流将自动部署到 `https://yourusername.github.io/spring-festival-simulator/`

### 手动部署

将项目文件上传至任何静态网站托管服务：

- [GitHub Pages](https://pages.github.com/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/)

### 部署注意事项

1. **确保文件路径正确**：所有资源使用相对路径
2. **CORS 设置**：如果使用外部 API，需要配置跨域
3. **浏览器兼容性**：支持 Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

---

## 数据文件说明
所有数据位于 `data/`，可直接修改并刷新页面查看效果。

### characters.json
- 字段：`id`、`name`、`title/identity`、`monologue`、`avatar`、`initial_attributes`
- `initial_attributes` 仅包含：`deposit`、`weight`、`face`、`mood`、`health`、`luck`

### common_events.json
- 通用事件，所有角色均可触发
- 字段示例：`event_id`、`event_name`、`trigger_condition`（`probability`/`scene`）、`description`、`options`（包含 `effects`）

### character_events.json
- 角色专属事件；`character_id` 必须与 `characters.json` 的 `id` 一致
- 可选触发窗口：`day`（1-9）、`time_slot`（`morning`/`noon`/`evening`；兼容 `afternoon→noon`、`night→evening`）
- 结构与通用事件一致

### endings.json
- 结局；`ending_id`、`ending_name`、`ending_type`（`success/failure/special/hidden`）、`character_id`（可空→通用）
- `unlockConditions` 支持两种写法：
  - 快捷写法：`min_face`、`max_mood` 等
  - 条件组：`[{ conditions: [{ attribute, operator, value }, ...] }]`

### achievements.json
- 成就；`id`、`name`、`desc`、`hidden`、`characterId`（可空→全角色可触发）、`condition`（属性条件）
- 条件示例：`{ "type": "attribute", "attribute": "deposit", "operator": ">=", "value": 100000 }`

---

## 🎨 技术栈

- **前端框架**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **样式框架**：Tailwind CSS (CDN)
- **字体**：Google Fonts (Ma Shan Zheng, Noto Sans SC)
- **图标**：Emoji + 自定义 SVG

---

## 🎯 游戏特色

### 漫画风格UI
- 🖼️ 粗边框设计 + 金色偏移阴影
- 🏷️ 倾斜标签装饰
- ✨ 丰富的动画效果

### 丰富的游戏内容
- 📚 100+ 个独特事件
- 🎭 10 个可选角色
- 🏆 20+ 种不同结局

### 属性系统
| 属性 | 说明 |
|------|------|
| 💰 存款 | 你的财富值 |
| ⚖️ 体重 | 健康状况的指标 |
| 😎 面子 | 社会地位和尊严 |
| 😊 心情 | 心理健康指数 |
| ❤️ 健康 | 身体健康状况 |
| 🍀 运气 | 随机事件的影响 |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 部署
### GitHub Pages
- 已配置 `.github/workflows/deploy.yml`，推送至 `main` 自动部署到 Pages
### 其他静态托管
- Vercel / Netlify / Cloudflare Pages 等，直接上传整站文件即可
- 资源路径均为相对路径，无需后端

---

## 📜 许可证

本项目基于 [CC BY-NC 4.0](LICENSE) 开源。

---

## 🙏 致谢

- UI gemini 生成
- 字体支持：Google Fonts
- CSS 框架：Tailwind CSS

---

<div align="center">

**🧧 祝你游戏愉快，春节快乐！🧧**

*Made with ❤️ for Chinese New Year 2026*

</div>
