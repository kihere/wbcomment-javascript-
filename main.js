// main.js — 主入口：加载 UI + 绑定所有控件逻辑
"ui";

ui.layoutFile("ui.xml");
let { runTask } = require("./logic.js");
// 日志工具
let logLines = [];

// 配置存储 —— 必须用 storages.create() 初始化，才能持久化
const storage = storages.create("weibo_comment_config");

// 从存储中加载配置
function loadConfig() {
    try {
        let savedConfig = storage.get("cfg");
        if (savedConfig) {
            // 设置群号
            if ("groupId" in savedConfig) {
                ui.etGroupNumber.setText(savedConfig.groupId);
            }
            // 设置评论列表
            if ("comments" in savedConfig && savedConfig.comments && savedConfig.comments.length > 0) {
                ui.etCommentList.setText(savedConfig.comments.join("\n"));
            }
            // 设置轮询间隔
            if ("loopDelay" in savedConfig) {
                ui.etRepeatInterval.setText(savedConfig.loopDelay.toString());
            }
            // 设置模块间隔
            if ("moduleDelay" in savedConfig) {
                ui.etModuleInterval.setText(savedConfig.moduleDelay.toString());
            }
            // 设置下滑高度
            if ("scrollHeight" in savedConfig) {
                ui.etScrollHeight.setText(savedConfig.scrollHeight.toString());
            }
            // 设置下滑时长
            if ("scrollDuration" in savedConfig) {
                ui.etScrollDuration.setText(savedConfig.scrollDuration.toString());
            }
            // 设置举报开关
            if ("enableReport" in savedConfig) {
                ui.switchReport.checked = savedConfig.enableReport;
            }
            // 设置举报条数
            if ("reportCount" in savedConfig) {
                ui.etReportCount.setText(savedConfig.reportCount.toString());
            }
            console.log("配置加载成功");
        }
    } catch (e) {
        console.log("配置加载失败: " + e);
    }
}

// 保存配置到存储
function saveConfigToStorage(cfg) {
    try {
        storage.put("cfg", cfg);
        console.log("配置保存到存储成功");
    } catch (e) {
        console.log("配置保存到存储失败: " + e);
    }
}

// 初始化时加载配置
loadConfig();

// 获取内存使用情况
function getMemoryMB() {
    var rt = java.lang.Runtime.getRuntime();
    return ((rt.totalMemory() - rt.freeMemory()) / 1024 / 1024).toFixed(1);
}

function appendLog(msg) {
    let memory = getMemoryMB();
    let line = "[" + new Date().toLocaleTimeString() + "] [内存: " + memory + "MB] " + msg;

    logLines.push(line);
    if (logLines.length > 200) logLines.shift();

    // ui.post() 是 Pro 9.3 推荐的跨线程 UI 更新方式
    ui.post(function () {
        ui.tvLog.setText(logLines.join("\n"));
    });

    console.log(line); // 同步写控制台，方便调试
}
// 状态点颜色辅助
function setStatus(text, dotColor) {
    ui.run(function () {
        ui.tvStatus.setText(text);
        ui.statusDot.attr("bg", dotColor);
    });
}
 
function setCounter(remaining) {
    ui.run(function () {
        ui.tvCounter.setText("剩余 " + remaining + " 条");
    });
}
// 评论数量实时统计
function countComments(raw) {
    return raw.split("\n").map(function (s) { return s.trim(); })
              .filter(function (s) { return s.length > 0; }).length;
}
 
ui.etCommentList.on("text-change", function () {
    let raw = ui.etCommentList.getText().toString();
    let n   = countComments(raw);
    ui.tvCommentCount.setText("共" + n + "条");
});
// 读取配置工具
function readConfig() {
    let groupId  = ui.etGroupNumber.getText().toString().trim();
    let rawList  = ui.etCommentList.getText().toString();
    let comments = rawList.split("\n")
                          .map(function (s) { return s.trim(); })
                          .filter(function (s) { return s.length > 0; });
    let loopDelay   = parseInt(ui.etRepeatInterval.getText().toString()) || 3000;
    let moduleDelay = parseInt(ui.etModuleInterval.getText().toString()) || 3000;
    let scrollHeight = parseInt(ui.etScrollHeight.getText().toString()) || 500;
    let scrollDuration = parseInt(ui.etScrollDuration.getText().toString()) || 400;
    let enableReport = ui.switchReport.checked;
    let reportCount = parseInt(ui.etReportCount.getText().toString()) || 5;
    return { 
        groupId: groupId, 
        comments: comments, 
        loopDelay: loopDelay, 
        moduleDelay: moduleDelay,
        scrollHeight: scrollHeight,
        scrollDuration: scrollDuration,
        enableReport: enableReport,
        reportCount: reportCount
    };
}
// 保存配置按钮
ui.btnSaveConfig.on("click", function () {
    let cfg = readConfig();
    if (!cfg.groupId)            { toast("群号不能为空");     return; }
    if (cfg.comments.length < 1) { toast("评论列表不能为空"); return; }
    // 保存配置到存储
    saveConfigToStorage(cfg);
    toast("配置已保存 ✓");
    appendLog("配置保存 | 群号:" + cfg.groupId
            + " | 评论:" + cfg.comments.length + "条"
            + " | 轮询:" + cfg.loopDelay + "ms"
            + " | 模块:" + cfg.moduleDelay + "ms"
            + " | 下滑高度:" + cfg.scrollHeight + "px"
            + " | 下滑时长:" + cfg.scrollDuration + "ms"
            + " | 举报:" + (cfg.enableReport ? "启用" : "禁用")
            + " | 举报条数:" + cfg.reportCount + "条");

});
// 任务控制
let taskThread = null;
let stopFlag   = { stopped: false };
 
ui.btnStart.on("click", function () {
    if (taskThread && taskThread.isAlive()) {
        toast("任务已在运行中");
        return;
    }
    let cfg = readConfig();
    let groupId     = ui.etGroupNumber.getText().toString().trim();
    let commentText = ui.etCommentList.getText().toString().trim();
 
    if (!groupId)     { toast("请输入群号");     return; }
    if (!commentText) { toast("请输入评论内容"); return; }
 
    // 重置状态
    logLines   = [];
    stopFlag   = { stopped: false };
    appendLog("任务启动 | 群号: " + groupId);
 
    taskThread = threads.start(function () {
        try {
            runTask(cfg, appendLog, setCounter, stopFlag);
        } catch (e) {
            appendLog("任务异常退出: " + e);
            // 确保关闭屏幕常亮
            try {
                // 尝试使用不同的方式关闭屏幕常亮
                if (device.cancelKeepScreenOn) {
                    device.cancelKeepScreenOn();
                }
                appendLog("关闭屏幕常亮");
            } catch (err) {
                appendLog("关闭屏幕常亮时出错: " + err);
            }
        }
    });
});
ui.btnStop.on("click", function () {
    if (!taskThread || !taskThread.isAlive()) {
        toast("当前无运行中的任务");
        return;
    }
    stopFlag.stopped = true;
    setStatus("正在停止…", "#F39C12");
    appendLog("已发送停止信号，等待当前步骤完成…");
});
// 清空日志
ui.btnClearLog.on("click", function () {
    logLines = [];
    ui.tvLog.setText("");
});
// ── 5. 界面销毁时自动停止 ──
ui.emitter.on("exit", function () {
    stopFlag.stopped = true;
    if (taskThread && taskThread.isAlive()) {
        taskThread.interrupt();
    }
    // 确保关闭屏幕常亮
    try {
        // 尝试使用不同的方式关闭屏幕常亮
        if (device.cancelKeepScreenOn) {
            device.cancelKeepScreenOn();
        }
        console.log("关闭屏幕常亮");
    } catch (e) {
        console.log("关闭屏幕常亮时出错: " + e);
    }
});