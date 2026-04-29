// logic.js — 纯业务逻辑，不含任何 UI 初始化

// ─────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────

// 日志函数
function log(msg) {
    console.log(msg);
}

// 举报相关函数 - 优化版本
function 举报() {
    log("开始举报操作 - 步骤1: 点击投诉按钮");
    let tousu = id("tv_menu").className("android.widget.TextView").text("投诉").findOne();
    log("找到投诉按钮，执行点击");
    tousu.parent().click();
    sleep(3000);

    log("步骤2: 点击违法信息选项");
    let weifaxinxi = text("违法信息").findOne(3000);
    weifaxinxi.parent().click();
    sleep(3000);

    log("步骤3: 点击色情低俗选项");
    let tsleixing = text("色情低俗").findOne(3000);
    tsleixing.parent().click();
    sleep(3000);

    log("步骤4: 点击低俗信息选项");
    let reason = null;
    let clickSuccess = false;

    try {
        reason = text("低俗信息").findOne(3000);
        if (reason) {
            log("找到低俗信息选项，执行直接点击");
            reason.click();
            clickSuccess = true;
        }
    } catch (e1) {
        log("直接点击低俗信息选项失败: " + e1);
        try {
            if (reason) {
                reason.parent().click();
                clickSuccess = true;
            }
        } catch (e2) {
            log("点击父元素失败: " + e2);
            try {
                if (reason) {
                    let bounds = reason.bounds();
                    click(bounds.centerX(), bounds.centerY());
                    clickSuccess = true;
                }
            } catch (e3) {
                log("坐标点击失败: " + e3);
            }
        }
    }

    if (!clickSuccess) {
        try {
            let reasonList = className("android.widget.TextView").find();
            for (let i = 0; i < reasonList.length; i++) {
                let item = reasonList[i];
                try {
                    if (item.text() === "低俗信息") {
                        item.click();
                        clickSuccess = true;
                        break;
                    }
                } catch (e) {
                    continue;
                } finally {
                    if (item) item.recycle();
                }
            }
        } catch (e) {
            log("使用className查找失败: " + e);
        }
    }

    if (clickSuccess) {
        log("低俗信息选项点击完成，等待1秒");
        sleep(1000);
    } else {
        log("警告: 未找到或无法点击低俗信息选项");
        throw new Error("无法找到或点击低俗信息选项");
    }

    log("步骤5: 点击提交按钮");
    let submit = className("android.widget.Button").findOne();
    submit.click();
    log("提交按钮点击完成，等待3秒");
    sleep(3000);

    log("举报操作完成");
}

// ─── 优化1: 超时控制的举报执行 ───────────────────────────────────────────────
// 返回值：
//   "success"  - 举报成功
//   "timeout"  - 超过 timeoutMs 毫秒仍未完成，需下滑后重试本条评论
//   "failed"   - 重试耗尽仍失败
function 执行举报带超时(timeoutMs) {
    timeoutMs = timeoutMs || 30000; // 默认30秒超时
    var startTime = new Date().getTime();
    var maxRetries = 2;

    for (var retryCount = 0; retryCount <= maxRetries; retryCount++) {
        // 每次进入循环先检查是否已超时
        if (new Date().getTime() - startTime >= timeoutMs) {
            log("举报操作已超过 " + (timeoutMs / 1000) + " 秒，判定超时，需下滑后重试");
            return "timeout";
        }

        if (retryCount > 0) {
            log("重试举报操作，第" + retryCount + "次");
            sleep(2000);
            try { back(); sleep(1000); } catch (e2) { log("回退失败：" + e2); }
        }

        try {
            举报();
            var elapsed = (new Date().getTime() - startTime) / 1000;
            log("举报成功，耗时：" + elapsed + " 秒");
            return "success";
        } catch (e) {
            log("举报出错（第" + (retryCount + 1) + "次）：" + e);
        }
    }

    log("重试耗尽，举报失败");
    return "failed";
}

function getNodeId(node) {
    return node.text();
}

// ─── 优化2: 严格的可见性检测，过滤边缘残缺评论 ───────────────────────────────
// minVisibleRatio：节点在屏幕内的面积占自身面积的最小比例（0~1），低于此值视为不可点击
function getVisibleCommentNodes(minVisibleRatio) {
    minVisibleRatio = minVisibleRatio || 0.6; // 默认至少60%在屏幕内才算可点击

    var nodes = id("tvItemCmtContent")
        .className("android.widget.TextView")
        .find();

    if (!nodes || nodes.length === 0) return [];

    var screenHeight = device.height;
    var screenWidth = device.width;
    var visibleNodes = [];

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        try {
            var b = node.bounds();

            // 坐标合法性校验
            if (!b || b.left < 0 || b.top < 0 || b.right <= b.left || b.bottom <= b.top) {
                continue;
            }

            var nodeW = b.right - b.left;
            var nodeH = b.bottom - b.top;
            var nodeArea = nodeW * nodeH;
            if (nodeArea <= 0) continue;

            // 计算节点与屏幕的交集区域
            var ix1 = Math.max(b.left, 0);
            var iy1 = Math.max(b.top, 0);
            var ix2 = Math.min(b.right, screenWidth);
            var iy2 = Math.min(b.bottom, screenHeight);

            if (ix2 <= ix1 || iy2 <= iy1) continue; // 完全不在屏幕内

            var intersectArea = (ix2 - ix1) * (iy2 - iy1);
            var visibleRatio = intersectArea / nodeArea;

            if (visibleRatio >= minVisibleRatio) {
                visibleNodes.push(node);
            } else {
                log("评论可见比例不足(" + (visibleRatio * 100).toFixed(0) + "%)，跳过：" + node.text().substring(0, 10));
            }
        } catch (e) {
            continue;
        }
    }
    return visibleNodes;
}

function scrollDown(scrollHeight, scrollDuration) {
    // 使用配置的参数，如果没有则使用默认值
    var duration = scrollDuration || 600;
    var w = device.width, h = device.height;

    // 计算下滑距离，如果没有配置则使用默认值
    var startY = h * 0.75;
    var endY = h * 0.3;
    if (scrollHeight) {
        endY = Math.max(h * 0.1, startY - scrollHeight);
    }

    gesture(duration, [w / 2, startY], [w / 2, endY]);
    sleep(duration);
}

// ─── 优化3: 主循环，支持超时后下滑重试同一条评论 ─────────────────────────────
function 主循环(MAX_COUNT, MAX_SCROLL, logFn, cfg) {
    var count = 0;
    var processedIds = [];  // 已成功举报的评论ID
    var scrollCount = 0;
    var TIMEOUT_MS = 30000; // 举报超时阈值（毫秒）

    while (count < MAX_COUNT && scrollCount <= MAX_SCROLL) {

        var visibleNodes = getVisibleCommentNodes(0.6);
        logFn("当前可见且可点击评论：" + visibleNodes.length + " 条");

        if (visibleNodes.length === 0) {
            logFn("未检测到可点击评论，下滑重试...");
            scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);
            scrollCount++;
            continue;
        }

        var screenHeight = device.height;
        var screenWidth = device.width;
        var foundUnprocessed = false;

        for (var i = 0; i < visibleNodes.length; i++) {
            var node = visibleNodes[i];

            try {
                var freshBounds = node.bounds();

                // 再次检查节点在屏幕内的可见比例（防止滑动后坐标已变）
                var nodeW = freshBounds.right - freshBounds.left;
                var nodeH = freshBounds.bottom - freshBounds.top;
                var nodeArea = nodeW * nodeH;
                var ix1 = Math.max(freshBounds.left, 0);
                var iy1 = Math.max(freshBounds.top, 0);
                var ix2 = Math.min(freshBounds.right, screenWidth);
                var iy2 = Math.min(freshBounds.bottom, screenHeight);
                var visibleRatio = (nodeArea > 0 && ix2 > ix1 && iy2 > iy1)
                    ? ((ix2 - ix1) * (iy2 - iy1)) / nodeArea
                    : 0;

                if (visibleRatio < 0.6) {
                    logFn("节点位置已变化或边缘残缺，跳过（可见比例：" + (visibleRatio * 100).toFixed(0) + "%");
                    continue; // 继续找下一条
                }

                var nodeId = getNodeId(node);

                if (processedIds.indexOf(nodeId) !== -1) {
                    logFn("已成功举报过，跳过：" + nodeId);
                    continue; // 继续找下一条未处理的评论
                }

                // ─── 找到第一条未处理的评论，标记后执行，完成后 break ───
                foundUnprocessed = true;

                var cx = (freshBounds.left + freshBounds.right) / 2;
                var cy = (freshBounds.top + freshBounds.bottom) / 2;

                logFn("处理评论[" + i + "]：" + node.text());

                // 尝试点击评论
                var clickSuccess = false;
                for (var j = 0; j < 3 && !clickSuccess; j++) {
                    try {
                        click(cx, cy);
                        clickSuccess = true;
                    } catch (e) {
                        logFn("点击失败，重试：" + e);
                        sleep(1000);
                    }
                }

                if (!clickSuccess) {
                    logFn("点击失败，跳过该评论");
                    continue; // 继续找下一条
                }

                sleep(3000);

                var activity = currentActivity();
                logFn("当前Activity：" + activity);

                if (
                    activity === "com.sina.weibo.feed.SubCommentActivity" ||
                    activity === "com.sina.weibo.feed.SubCommentActiity"
                ) {
                    logFn("进入子评论页，回退");
                    processedIds.push(nodeId); // 子评论页无需举报，标记跳过
                    back();
                    sleep(500);

                } else if (
                    activity === "com.sina.weibo.feed.detailrefactor.DetailPageActivity" ||
                    activity === "com.sina.weibo.feed.DetailWeiboActivity" ||
                    activity === "com.sina.weibo.feed.MPDialogActivity"
                ) {
                    logFn("留在详情页，执行举报（超时阈值：" + (TIMEOUT_MS / 1000) + "秒）");

                    var reportResult = 执行举报带超时(TIMEOUT_MS);

                    if (reportResult === "success") {
                        // ✅ 举报成功，标记已处理
                        processedIds.push(nodeId);
                        count++;
                        logFn("举报成功，累计已举报：" + count + " 次");
                        sleep(500);

                    } else if (reportResult === "timeout") {
                        // ⏱ 超时：不标记为已处理，下滑后下次循环继续重试本条评论
                        logFn("举报超时，下次循环将重试本条评论");
                        try { sleep(500); } catch (e) { }
                        try { sleep(500); } catch (e) { }
                        scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);
                        scrollCount++;

                    } else {
                        // ❌ 重试耗尽仍失败，标记跳过避免死循环
                        logFn("举报彻底失败，跳过本条评论");
                        processedIds.push(nodeId);
                        try { sleep(500); } catch (e) { }
                    }

                    if (count >= MAX_COUNT) {
                        logFn("已完成 " + MAX_COUNT + " 次举报，程序结束");
                        break;
                    }

                } else if (activity === "com.sina.weibo.feed.detail.composer.ComposerActivity") {
                    logFn("进入ComposerActivity，回退两次并下滑");
                    back(); sleep(500);
                    back(); sleep(500);
                    scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);

                } else if (activity === "com.sina.weibo.composerinde.ForwardComposerActivityV2") {
                    logFn("进入ForwardComposerActivityV2，回退两次并下滑");
                    back(); sleep(500);
                    back(); sleep(500);
                    scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);

                } else if (activity === "com.sina.weibo.weiyou.chat.group.setting.MessageGroupManageActivity") {
                    logFn("进入MessageGroupManageActivity，回退并标记为已处理");
                    processedIds.push(nodeId); // 标记为已处理
                    back(); sleep(500);
                    scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);
                    scrollCount++;

                } else {
                    logFn("未知Activity：" + activity + "，回退并下滑");
                    back(); sleep(500);
                    scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);
                    scrollCount++;
                }

            } catch (e) {
                logFn("处理评论时出错：" + e);
                try { back(); sleep(1000); } catch (e2) { logFn("回退失败：" + e2); }
            } finally {
                if (node) node.recycle();
            }

            // 处理完一条（无论结果如何）即退出 for，回到 while 重新扫描屏幕
            break;
        }

        if (!foundUnprocessed) {
            logFn("当前屏幕无新评论，下滑加载更多...");
            scrollDown(cfg && cfg.scrollHeight, cfg && cfg.scrollDuration);
            scrollCount++;
        }
    }

    return count;
}

function 处理评论页面(reportCount, logFn, cfg) {
    var MAX_COUNT = reportCount;
    var MAX_SCROLL = 20; // 增加到20次滚动

    try {
        var commentCountNode = id("tv_comment_count").findOne();
        if (commentCountNode) {
            var commentCountText = commentCountNode.text();
            logFn("评论总数文本：" + commentCountText);
            var match = commentCountText.match(/\d+/);
            if (match) {
                logFn("评论总数：" + parseInt(match[0]));
            }
        }
    } catch (e) {
        logFn("未找到评论总数控件：" + e);
    }

    var count = 主循环(MAX_COUNT, MAX_SCROLL, logFn, cfg);
    logFn("已举报 " + count + " 次，程序结束");

    // 释放内存
    java.lang.System.gc();
    logFn("举报模块内存已释放 | 内存: " + getMemoryMB() + "MB");
}

function getMemoryMB() {
    var rt = java.lang.Runtime.getRuntime();
    return ((rt.totalMemory() - rt.freeMemory()) / 1024 / 1024).toFixed(1);
}
//随机打乱数组 
function shuffle(arr) {
    if (!Array.isArray(arr)) return [];
    let a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}
//启动阶段
function 启动微博() {
    app.launch("com.sina.weibo");
    sleep(10000);
    toast("微博已经启动");
}

function 点击消息() {
    let target = null;
    try {
        target = className("android.widget.FrameLayout").desc("消息").findOne(2000);
        if (target) {
            target.click();
            toast("找到消息按钮，点击成功");
            sleep(3000);
        } else {
            toast("未找到消息控件");
        }
        let topMessage = className("android.widget.TextView").id("tab_text_view").text("消息").findOne(1000);
        if (topMessage) {
            topMessage.parent().click();
            var w = device.width, h = device.height;
            gesture(600, [w / 2, h * 0.2], [w / 2, h * 0.8]);
            sleep(1000);
        }
    } finally {
        if (target) { target.recycle(); target = null; }
    }
}

function 点击输入框() {
    let et = null;
    try {
        et = className("android.widget.EditText").id("tv_search_keyword").findOne(2000);
        if (et) {
            toast("找到输入框");
            et.click();
            sleep(3000);
        } else {
            toast("未找到搜索输入框");
        }
    } finally {
        if (et) { et.recycle(); et = null; }
    }
}

function 输入群号(groupId) {
    let searchInput = null;
    try {
        searchInput = id("tv_search_keyword").findOne(2000);
        if (searchInput) {
            let 状态 = searchInput.setText(groupId);
            if (状态) { toast("输入成功"); sleep(3000); }
            else { toast("输入失败"); }
        }
    } finally {
        if (searchInput) { searchInput.recycle(); searchInput = null; }
    }
}

function 点击进入群聊() {
    let obj = null;
    try {
        obj = className("FrameLayout").id("lyPortrait").findOne(2000);
        if (obj) {
            obj.parent().parent().parent().click();
            sleep(3000);
        }
    } finally {
        if (obj) { obj.recycle(); obj = null; }
    }
}
//循环执行
function 点击群聊作品() {
    let context = null;
    try {
        context = className("android.widget.TextView").id("blogMaxLineTextView").findOne(2000);
        if (context) {
            context.parent().parent().parent().parent().click();
            toast("点击成功");
            sleep(3000);
        } else {
            toast("点击失败");
        }
    } finally {
        if (context) { context.recycle(); context = null; }
    }
}
function 作品点击评论按钮() {
    let commentNode = null;
    let pinglunBtn = null;
    try {
        commentNode = id("tv_comment_count").findOne(2000);
        if (!commentNode) { toast("未提取到数据"); return false; }

        let commentText = commentNode.text();
        toast("已经提取到数据");
        sleep(1000);

        let commentNum = commentText.replace(/[^0-9]/g, "");
        pinglunBtn = className("android.widget.TextView").text(commentNum).findOne(2000);
        if (pinglunBtn) {
            pinglunBtn.parent().click();
            toast("评论按钮点击成功");
            sleep(1000);
            return true;
        } else {
            toast("评论按钮点击失败");
            return false;
        }
    } finally {
        if (commentNode) { commentNode.recycle(); commentNode = null; }
        if (pinglunBtn) { pinglunBtn.recycle(); pinglunBtn = null; }
    }
}
function 输入评论内容评论(commentText, moduleDelay) {
    let box = null;
    let send = null;
    try {
        box = className("android.widget.EditText").id("edit_view").findOne(2000);
        if (box) { box.setText(commentText); sleep(moduleDelay); }
        else { toast("评论框未出现"); return; }

        send = className("android.widget.TextView").id("btnSend").findOne(2000);
        if (send) { send.click(); toast("评论成功"); sleep(moduleDelay); }
        else { toast("发送按钮未找到"); }
    } finally {
        if (box) { box.recycle(); box = null; }
        if (send) { send.recycle(); send = null; }
    }
    back();
}
function 清空聊天记录(TARGET_ACTIVITY, moduleDelay) {
    let shezhi = null;
    let qingkong = null;
    let querenBtn = null;

    try {
        shezhi = className("android.widget.TextView").id("titleSave").findOne(2000);
        if (shezhi) { shezhi.parent().parent().click(); sleep(moduleDelay); }
        else { toast("未找到设置"); return; }
    } finally {
        if (shezhi) { shezhi.recycle(); shezhi = null; }
    }

    swipe(device.width / 2, device.height * 0.85, device.width / 2, device.height * 0.15, 800);
    sleep(moduleDelay);

    try {
        qingkong = className("android.widget.RelativeLayout")
            .id("message_group_delete_record").findOne(2000);
        if (qingkong) {
            qingkong.click();
            sleep(1000);
            querenBtn = className("android.widget.TextView").text("确定").findOne(2000);
            if (querenBtn) { querenBtn.click(); sleep(moduleDelay); }
        }
    } finally {
        if (qingkong) { qingkong.recycle(); qingkong = null; }
        if (querenBtn) { querenBtn.recycle(); querenBtn = null; }
    }

    back();
    let waited = 0;
    while (currentActivity() !== TARGET_ACTIVITY && waited < 6000) {
        sleep(500); waited += 500;
    }
}
//主任务入口 被main.js调用
/**
 * @param {object}   cfg            - { groupId, comments[], loopDelay, moduleDelay }
 * @param {function} logFn          - appendLog 回调
 * @param {function} setCounterFn   - setCounter(n) 回调，更新 UI 剩余数
 * @param {object}   stopFlag       - { stopped: false }
 */
function runTask(cfg, logFn, setCounterFn, stopFlag) {
    const TARGET_ACTIVITY = "com.sina.weibo.weiyou.chat.group.DMGroupChatActivity";
    const TARGET_ID = "blogMaxLineTextView";

    // 启用屏幕常亮
    logFn("启用屏幕常亮");
    device.wakeUp();
    // 尝试使用不同的方式保持屏幕常亮
    try {
        // 方式1: 使用device的方法
        if (device.keepScreenOn) {
            device.keepScreenOn();
        }
    } catch (e) {
        logFn("屏幕常亮设置失败: " + e);
    }

    // 打乱评论列表
    let commentQueue = shuffle(cfg.comments);
    setCounterFn(commentQueue.length);
    logFn("评论顺序已随机 | 共" + commentQueue.length + "条");

    // ── 初始化 ──
    logFn("启动微博…");
    启动微博();

    logFn("点击消息…");
    点击消息(); sleep(1000);

    logFn("点击输入框…");
    点击输入框(); sleep(1000);

    logFn("输入群号: " + cfg.groupId);
    输入群号(cfg.groupId); sleep(1000);

    logFn("进入群聊…");
    点击进入群聊(); sleep(5000);

    java.lang.System.gc();
    logFn("初始化完成 | 内存: " + getMemoryMB() + "MB");

    // ── 主循环 ──
    let gcCounter = 0;

    while (!stopFlag.stopped && commentQueue.length > 0) {
        sleep(cfg.loopDelay);

        if (++gcCounter % 10 === 0) {
            java.lang.System.gc();
            logFn("GC | 内存: " + getMemoryMB() + "MB");
        }

        if (currentActivity() !== TARGET_ACTIVITY) continue;

        let targetView = null;
        try {
            targetView = id(TARGET_ID).findOne(1000);
            if (!targetView) continue;
        } finally {
            if (targetView) { targetView.recycle(); targetView = null; }
        }

        // 取出下一条评论
        let currentComment = commentQueue.shift();
        setCounterFn(commentQueue.length);
        logFn("检测到作品 | 使用评论: " + currentComment + " | 剩余" + commentQueue.length + "条");

        try {
            // 第一次点击作品进入详情页
            点击群聊作品(); sleep(cfg.moduleDelay);
            java.lang.System.gc();

            // 如果启用了举报功能，执行举报操作
            if (cfg.enableReport) {
                logFn("开始执行举报操作");
                处理评论页面(cfg.reportCount, logFn, cfg);
                java.lang.System.gc();

                // 举报完成后，已经在评论区，直接进行评论
                logFn("举报完成，直接进行评论");
            }

            // 执行评论操作
            logFn("开始执行评论操作");
            let ok = 作品点击评论按钮(); sleep(cfg.moduleDelay);
            java.lang.System.gc();

            if (ok) {
                输入评论内容评论(currentComment, cfg.moduleDelay);
                java.lang.System.gc();
            } else {
                logFn("评论按钮点击失败，跳过评论操作");
            }

            清空聊天记录(TARGET_ACTIVITY, cfg.moduleDelay);
            java.lang.System.gc();

        } catch (e) {
            logFn("出错: " + e);
            java.lang.System.gc();
            // 尝试回退到群聊页面
            try {
                for (let i = 0; i < 3; i++) {
                    back();
                    sleep(500);
                }
            } catch (e2) {
                logFn("回退失败：" + e2);
            }
            sleep(2000);
        }
    }

    if (commentQueue.length === 0) {
        logFn("✅ 所有评论已发完，任务自动结束");
    } else {
        logFn("⏹ 任务已手动停止");
    }

    // 关闭屏幕常亮
    logFn("关闭屏幕常亮");
    // 尝试使用不同的方式关闭屏幕常亮
    try {
        // 方式1: 使用device的方法
        if (device.cancelKeepScreenOn) {
            device.cancelKeepScreenOn();
        }
    } catch (e) {
        logFn("屏幕常亮关闭失败: " + e);
    }
}
module.exports = {
    runTask: runTask
};