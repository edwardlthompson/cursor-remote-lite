// UI language. Source UI strings are English; Chinese mode swaps visible text through this table.
// Default follows the phone language (zh → Chinese, otherwise English). Override under ⋯ → Language.
// Chat content, file previews and window/model names are left alone (see SKIP).
const I18N = (() => {
  const saved = localStorage.getItem('cr-lang');
  const lang = saved === 'zh' || saved === 'en' ? saved : /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';

  const ZH = {
  "Connecting…": "连接中…",
  "Chat": "对话",
  "Files": "文件",
  "Screen": "画面",
  "Changed files": "改动的文件",
  "No pending changes.": "没有待处理的改动。",
  "When the Agent edits files, they show up here — same Keep / Undo as on the desktop.": "Agent 改文件后会出现在这里，Keep / Undo 与电脑上一样。",
  "Diff": "差异",
  "↑ Load earlier messages": "↑ 加载更早的消息",
  "No chat panel found.": "没找到聊天面板。",
  "Open an Agent chat in Cursor, or switch to \"Screen\".": "请在 Cursor 里打开 Agent 对话，或切到「画面」查看。",
  "↓ Latest": "↓ 最新",
  "Chat panel": "聊天面板",
  "Whole window": "整个窗口",
  "Tap": "点击",
  "Scroll": "滚动",
  "Refresh": "刷新",
  "Enter": "回车",
  "⌘Enter": "⌘回车",
  "Open chat": "打开聊天",
  "Right-click": "右键",
  "History": "历史",
  "+ New": "＋ 新建",
  "Message Cursor Agent…": "发给 Cursor Agent…",
  "Send": "发送",
  "Wrap": "换行",
  "Open in app": "在 App 中打开",
  "Retry": "重试",
  "Not connected": "未连接",
  "Connected": "已连接",
  "Disconnected, reconnecting…": "断开，重连中…",
  "Sent": "已发送",
  "The computer has not published its address yet (or runs an old version). Restart the service on the computer.": "电脑端还没有发布地址（或还在用旧版本），请在电脑上重启服务",
  "Pairing is no longer valid (the computer was reset). Please pair again.": "配对信息已失效（电脑端重置过），请重新配对",
  "This device is not paired yet.": "这台设备还没有配对。",
  "Run npm run pair on the computer and scan the code, or paste the pairing link below.": "在电脑上运行 npm run pair，用手机扫码；或者把链接复制过来粘贴到下面。",
  "Paste pairing link": "粘贴配对链接",
  "Pair": "配对",
  "Verify": "验证",
  "That is not a pairing link (it should contain #pair=…)": "这不是配对链接（应包含 #pair=…）",
  "Enter the 6-digit \"Cursor Remote\" code from your Authenticator app": "请输入 Authenticator 里「Cursor Remote」的 6 位验证码",
  "Pairing…": "正在配对…",
  "Cannot reach the computer. The pairing link is valid for 10 minutes; try again shortly.": "连不上电脑，配对链接 10 分钟内有效，稍后重试",
  "Pairing failed": "配对失败",
  "This device was paired before and can keep using it.": "这台设备之前已经配对过，可以继续使用。",
  "Continue": "继续使用",
  "Verifying…": "正在验证…",
  "Verification failed": "验证失败",
  "Cannot reach the computer": "连不上电脑",
  "Pairing link received.": "已收到配对链接。",
  "Open it in the Android app if installed; otherwise use it in the browser.": "装了安卓 App 就在 App 里打开；否则直接在浏览器里用。",
  "Continue in browser": "在浏览器里继续",
  "Looking for the computer…": "正在查找电脑…",
  "Could not load. Check your phone's network (github.io must be reachable).": "读取失败，请检查手机网络（需要能打开 github.io）",
  "The computer's address isn't published yet.": "还没有找到电脑地址。",
  "Run npm run public on the computer and keep that window open, then tap Retry in about a minute.": "请在电脑上运行 npm run public 并保持窗口开着，约 1 分钟后点重试。",
  "Computer offline: it may be off, asleep, or the service just restarted (a new address takes about a minute). Retrying automatically…": "电脑不在线：可能关机、睡眠，或服务刚重启（新地址约 1 分钟后生效）。会自动重试…",
  "This device was removed. Please pair again.": "这台设备已被移除，请重新配对",
  "Switch Cursor window": "切换 Cursor 窗口",
  "No windows found": "没有找到窗口",
  "Local": "本地",
  "\"Agents\" is Cursor's dedicated Agent window; the others are regular editor windows (IDE mode), including SSH remotes.": "「Agents」是 Cursor 专门跑 Agent 的窗口；其他是普通编辑器窗口（IDE 模式），SSH 远程窗口也在这里。",
  "Mode": "选择模式",
  "Model": "选择模型",
  "Chat history": "历史对话",
  "The menu is empty; your Cursor version may differ": "菜单是空的，可能 Cursor 版本不同",
  "Larger context, costs more": "更大上下文、更贵",
  "Params": "参数",
  "Changes apply directly to this model in Cursor on your computer.": "改动会直接应用到电脑上 Cursor 的这个模型。",
  ": on": "：开",
  ": off": "：关",
  "Paired devices": "已配对设备",
  "Remove": "移除",
  "Add a device: run npm run pair on the computer.": "添加新设备：在电脑上运行 npm run pair。",
  "Turn on Authenticator 2FA: npm run 2fa.": "开启 Authenticator 二次验证：npm run 2fa。",
  "Intl": "海外",
  "Long-press a QR code to save it, then scan it from your photos in WeChat / Alipay.": "手机上可以长按二维码保存，再用微信 / 支付宝「扫一扫」从相册识别。",
  "Notifications: on": "通知：已开启",
  "Alerts when the Agent finishes or needs your OK": "Agent 完成或等你确认时提醒",
  "Turn off": "关闭",
  "Send a test notification": "发一条测试通知",
  "Turn on notifications": "开启通知",
  "New": "新",
  "Menu": "菜单",
  "Change app address": "更换 App 地址",
  "Add to home screen (opens like an app)": "安装到手机桌面（像 App 一样打开）",
  "Reconnect": "重新连接",
  "Unpair this device": "取消本机配对",
  "Update check failed; try again later": "检查更新失败，请稍后再试",
  "You are on the latest version": "已经是最新版本",
  "Checking for updates…": "正在检查更新…",
  "Downloading the new version; the installer opens when it is done": "正在下载新版本，下载完会弹出安装界面",
  "Notifications did not load; refresh and try again": "通知组件没有加载，请刷新后再试",
  "Notifications are on. On Huawei and similar phones, allow background activity in Settings → App launch.": "通知已开启。华为等手机请在「设置 → 应用启动管理」里允许本 App 后台活动",
  "Update the Android app from the menu first; notifications need the new version": "请先在菜单里更新安卓 App，新版才支持通知",
  "On iPhone, first use Share → Add to Home Screen, then open from the home-screen icon to enable notifications": "iPhone 要先「分享 → 添加到主屏幕」，从桌面图标打开后才能开启通知",
  "This browser does not support notifications": "这个浏览器不支持通知",
  "No notification permission; allow it in system settings": "没有通知权限，请在系统设置里允许本 App 发通知",
  "Registration failed": "注册失败",
  "Notifications are on": "通知已开启",
  "Notifications are off": "通知已关闭",
  "Add to home screen": "安装到桌面",
  "Open this page in Safari → tap Share at the bottom → choose \"Add to Home Screen\".": "用 Safari 打开本页 → 点底部「分享」按钮 → 选「添加到主屏幕」。",
  "Open it from the home-screen icon for a full-screen app.": "安装后从桌面图标打开，就是全屏 App。",
  "Install the Android app": "安装安卓 App",
  "Download the Android app (recommended)": "下载安卓 App（推荐）",
  "Works on phones without Google services (e.g. Huawei) and from any browser. Open the download to install (allow \"unknown sources\" if asked).": "华为等没有谷歌服务的手机、任何浏览器都能装。下载后点开安装（如提示「未知来源」，允许即可）。",
  "On first launch, enter this address:": "首次打开填入这个地址：",
  "Copy": "复制",
  "Or: install via the browser (needs Google services)": "或者：用浏览器安装（需要谷歌服务）",
  "Switching…": "切换中…",
  "Toggling MAX Mode…": "切换 MAX Mode…",
  "Loading model parameters…": "读取模型参数…",
  "Applying…": "设置中…",
  "Address copied": "已复制地址",
  "Copy failed; note the address manually": "复制失败，请手动记下地址",
  "Test notification sent; it should arrive within seconds": "已发送测试通知，几秒内应该收到",
  "Send failed": "发送失败",
  "Unpair this device? You will need to run npm run pair on the computer again to use it.": "取消本机配对？之后要在电脑上重新运行 npm run pair 才能再用。",
  "Viewing a subagent's chat (read-only)": "正在查看子 Agent 的对话（只读）",
  "Back to main chat": "返回主对话",
  "View": "查看",
  "Stop": "停止",
  "Edit": "修改",
  "Send now": "立即发送",
  "Delete": "删除",
  "Interrupt the current turn and send right away": "打断当前这一轮，立刻发送",
  "Agent is running; the messages below are sent in order when this turn ends": "Agent 正在运行，下面的消息会在这一轮结束后依次发送",
  "Agent is running; new messages will be queued": "Agent 正在运行，现在发的消息会先排队",
  "(empty)": "(空)",
  "That queued message is gone": "这条排队消息已经不在了",
  "Edit queued message": "修改排队消息",
  "Save (stays queued)": "保存（仍在排队）",
  "The message cannot be empty; use \"Delete\" to drop it": "内容不能为空；不想要这条就点「删除」",
  "Updating queued message…": "正在修改排队消息…",
  "Agent stopped": "已停止 Agent",
  "Returning to main chat…": "返回主对话…",
  "Subagent stopped": "已停止子 Agent",
  "Opening subagent…": "正在打开子 Agent…",
  "Queued message sent now": "已立即发送这条排队消息",
  "Queued message deleted": "已删除这条排队消息",
  "Loading modes…": "读取模式列表…",
  "Loading models…": "读取模型列表…",
  "Loading chat history…": "读取历史对话…",
  "New chat started": "已新建对话",
  "Reading from the computer…": "正在从电脑读取…",
  "You can open it in Cursor from the \"Screen\" tab": "可以切到「画面」在 Cursor 里打开",
  "File too long; showing the first 512 KB": "文件太长，只显示了前 512 KB",
  "Listening… (tap again to stop)": "请说话…（再点一下结束）",
  "Listening…": "请说话…",
  "Didn't catch that, try again": "没听清，再试一次",
  "No microphone permission": "没有麦克风权限",
  "Speech recognition cannot reach its server; use the microphone on your keyboard instead": "语音识别连不上服务器（国内网络常见），可以用输入法键盘上的麦克风",
  "This browser has no speech recognition; use the microphone on your keyboard instead": "这个浏览器不支持语音识别，可以用输入法键盘上的麦克风",
  "Update the Android app for voice input, or use the microphone on your keyboard": "更新安卓 App 后可用语音输入，也可以用输入法键盘上的麦克风",
  "No speech recognition service on this phone; use the microphone on your keyboard instead": "手机上没有语音识别服务，可以用输入法键盘上的麦克风",
  "Voice input": "语音输入",
  "Voice button": "语音按钮",
  "Not needed if your keyboard has a mic": "输入法键盘自带麦克风的话用不着",
  "Cancel": "取消",
  "OK": "确定",
  "Unpair": "取消配对",
  "Stop the Agent?": "停止 Agent？",
  "Whatever it is doing in this turn will be interrupted.": "它这一轮正在做的事会中断。",
  "Its unfinished work will be interrupted.": "它做到一半的工作会中断。",
  "Send this message now?": "立即发送这条消息？",
  "The Agent's current turn will be interrupted.": "Agent 当前这一轮会被打断。",
  "Delete this queued message?": "删除这条排队消息？",
  "Attach image": "附加图片",
  "Processing image…": "正在处理图片…",
  "Couldn't read that image; try another": "读不了这张图片，换一张试试",
  "Image attached in Cursor; type your message and tap Send": "图片已附加到 Cursor 输入框，写好文字后点发送",
  "Only PNG / JPEG / GIF / WebP images are supported": "只支持 PNG / JPEG / GIF / WebP 图片",
  "Cursor didn't accept the image (the current model may not support images)": "Cursor 没有接收这张图片（当前模型可能不支持图片）",
  "❓ The Agent is asking you": "❓ Agent 在问你",
  "Other…": "其他…",
  "Set": "填入",
  "Skip": "跳过",
  "Submit": "提交",
  "Skipped": "已跳过",
  "Submitted": "已提交",
  "That question is gone (maybe it was answered on the computer)": "这个问题已经不在了（可能已在电脑上回答）",
  "Keep": "保留",
  "Undo": "撤销",
  "Loading changed files…": "读取改动的文件…",
  "No pending changes": "没有待处理的改动",
  "Undoing…": "正在撤销…",
  "Keeping…": "正在保留…",
  "Working…": "处理中…",
  "Tap a file name to view it. \"Keep\" accepts the change to that file; \"Undo\" restores it to how it was before.": "点文件名查看内容。「保留」接受这个文件的改动，「撤销」把它恢复成改动前的样子。",
  "The file goes back to how it was before the Agent changed it.": "文件会恢复成 Agent 改之前的样子。",
  "Unsupported action": "不支持的操作",
  "The file list changed; open it again": "文件列表已经变了，请重新打开",
  "Button not found (your Cursor version may differ)": "没找到这个按钮（可能 Cursor 版本不同）",
  "Updated, still queued": "已修改，仍在排队",
  "Agent is running; queued, and it sends automatically when this turn ends": "Agent 正在运行，已加入排队，这一轮结束后自动发送",
  "That button is gone; the state may have changed": "按钮已经不在了，可能状态已变化",
  "Cursor did not enter edit mode; nothing changed": "Cursor 没有进入编辑状态，没改动",
  "Unsupported queue action": "不支持的排队操作",
  "That queued message is gone (it may have just been sent)": "这条排队消息已经不在了（可能刚被发出）",
  "Could not find the queue buttons (your Cursor version may differ)": "没找到排队消息的操作按钮（可能 Cursor 版本不同）",
  "That subagent has finished, or Cursor cannot find it": "这个子 Agent 已经结束了，或者 Cursor 里找不到它",
  "Cannot find the main chat tab; switch back manually in \"Screen\"": "找不到原来的主对话标签页，请在「画面」里手动切回",
  "The Agent is not running": "Agent 当前没有在运行",
  "This window has no such button (your Cursor version or layout may differ)": "当前窗口里没有这个按钮（可能是 Cursor 版本或布局不同）",
  "This Cursor version has no MAX Mode toggle": "这个 Cursor 版本没有 MAX Mode 开关",
  "That model is not in the list": "模型列表里找不到这个模型",
  "This model has no adjustable parameters": "这个模型没有可调的参数",
  "The parameter menu did not open (your Cursor version may differ)": "参数菜单没有打开（可能 Cursor 版本不同）",
  "Not a file path": "不是文件路径",
  "Binary file; cannot preview": "二进制文件，不能预览",
  "No Cursor window found; make sure Cursor was started with --remote-debugging-port=9222": "没有找到 Cursor 窗口，确认 Cursor 是以 --remote-debugging-port=9222 启动的",
  "Lost connection to the Cursor window": "Cursor 窗口连接已断开",
  "No visible chat input: open the Agent panel in \"Screen\" first (or tap \"Open chat\")": "没找到可见的聊天输入框：先在画面里打开 Agent 面板（或点「打开聊天」）",
  "Not connected to a Cursor window yet": "尚未连接到 Cursor 窗口",
  "Cannot reach Cursor: it was not started with start-cursor.sh (debug port is off)": "连不上 Cursor：Cursor 没有用 start-cursor.sh 启动（调试端口未开启）",
  "Too many attempts; try again in 15 minutes": "尝试次数过多，请 15 分钟后再试",
  "The pairing link is invalid or expired (valid 10 minutes, single use). Run npm run pair on the computer again.": "配对链接无效或已过期（10 分钟内有效，只能用一次）。请在电脑上重新运行 npm run pair",
  "Wrong code": "验证码不对",
  "Device not paired": "设备未配对",
  "Two-factor verification required": "需要二次验证",
  "Invalid subscription": "订阅信息无效"
};

  // Strings with a variable part (English → Chinese).
  const PATTERNS = [
    [/^Computer address updated (.+)$/, '电脑端地址更新于 $1'],
    [/^Paired (.+) · last used (.+)$/, '配对于 $1 · 最近使用 $2'],
    [/^Update the Android app \(v(.+) → v(.+)\)$/, '更新安卓 App（v$1 → v$2）'],
    [/^Check for app update \(now v(.+)\)$/, '检查 App 更新（当前 v$1）'],
    [/^Android app v(.+) is available; update from "⋯" at the top right$/, '安卓 App 有新版本 v$1，点右上角「⋯」更新'],
    [/^Downloading Android app v(.+)…$/, '正在下载安卓 App v$1…'],
    [/^(.*) parameters$/, '$1 参数'],
    [/^Subagents running: (\d+)$/, '子 Agent 运行中 $1 个'],
    [/^Queued: (\d+)$/, '排队中 $1 条'],
    [/^Stop subagent "(.+)"\?$/, '停止子 Agent「$1」？'],
    [/^❓ The Agent is asking you \((\d+) questions\)$/, '❓ Agent 在问你（$1 个问题）'],
    [/^1 file changed ›$/, '改动了 1 个文件 ›'],
    [/^(\d+) files changed ›$/, '改动了 $1 个文件 ›'],
    [/^Files changed by the Agent \((\d+)\)$/, 'Agent 改动的文件（$1）'],
    [/^Undo the changes to "(.+)"\?$/, '撤销「$1」的改动？'],
    [/^Really tap "(.+)"\?$/, '确定要点「$1」吗？'],
    [/^Remove "(.+)"\? It disconnects immediately and must be paired again\.$/, '移除「$1」？它会立即断开，要重新配对才能再用。'],
    [/^Could not turn on notifications: (.*)$/, '开启通知失败：$1'],
    [/^Tapped: (.*)$/, '已点击：$1'],
    [/^(.+): (on|off)$/, (m, a, b) => `${a}：${b === 'on' ? '开' : '关'}`],
    [/^Option not found: (.*)$/, '没找到选项：$1'],
    [/^Parameter not found: (.*)$/, '没找到参数：$1'],
    [/^File not found \(it may have been deleted or moved\): (.*)$/, '找不到文件（可能已被删除或移动）：$1'],
    [/^SSH connection to (.+) failed: (.*)$/, 'SSH 连接 $1 失败：$2'],
    [/^Image too large \((.+)\); view it on the computer$/, '图片太大（$1），请在电脑上看'],
    [/^Unknown key: (.*)$/, '未知按键: $1'],
    [/^Unknown command: (.*)$/, '未知指令: $1'],
    [/^(.*) \((Android app|Android browser|Mac browser|browser)\)$/, (m, a, b) => `${a}（${{ 'Android app': '安卓 App', 'Android browser': '安卓浏览器', 'Mac browser': 'Mac 浏览器', browser: '浏览器' }[b]}）`],
  ];

  const line = s => {
    const key = s.trim();
    if (!key) return s;
    let out = ZH[key];
    if (out == null) {
      for (const [re, to] of PATTERNS) {
        if (re.test(key)) {
          out = typeof to === 'function' ? key.replace(re, to) : key.replace(re, to);
          break;
        }
      }
    }
    if (out == null) return s;
    return s.replace(key, out);
  };
  const tr = s => lang === 'en' || s == null ? s : String(s).split('\n').map(line).join('\n');

  const SKIP = '#items, #vBody, #vName, #vPath, #titleText, .qt, [data-label] .lbl, [data-win] .lbl, .qnQ, .qnOpt span';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const fix = node => {
    if (node.nodeType === 3) {
      if (node.parentElement?.closest(SKIP)) return;
      const t = tr(node.nodeValue);
      if (t !== node.nodeValue) node.nodeValue = t;
      return;
    }
    if (node.nodeType !== 1 || node.closest(SKIP)) return;
    for (const a of ATTRS) if (node.hasAttribute(a)) { const v = node.getAttribute(a), t = tr(v); if (t !== v) node.setAttribute(a, t); }
    for (const c of node.childNodes) fix(c);
  };

  if (lang === 'zh') {
    document.documentElement.lang = 'zh-CN';
    const start = () => {
      fix(document.body);
      new MutationObserver(list => {
        for (const m of list) {
          if (m.type === 'characterData') fix(m.target);
          else if (m.type === 'attributes') fix(m.target);
          else m.addedNodes.forEach(fix);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    const confirm0 = window.confirm.bind(window);
    window.confirm = m => confirm0(tr(m));
  } else {
    document.documentElement.lang = 'en';
  }

  const set = v => { localStorage.setItem('cr-lang', v); location.reload(); };
  return { lang, tr, set, speech: lang === 'en' ? 'en-US' : 'zh-CN' };
})();
