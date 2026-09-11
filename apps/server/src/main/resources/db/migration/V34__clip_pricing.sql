-- 爱速拍六档生成单价：从 Spring 配置搬进数据库，让运营在后台改。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java
-- 两处（见本目录 README.md），已占用到 V33，故本次开 V34。
--
-- 为什么要搬：这六个数是**对外定价**，改一次要改目标机的 application.yml 再重启出片服务。
-- 军师那边的铁律是「会影响真实用户的对外数据（定价/权益）归运营后台，代码不许当真相源」，
-- 这六档一直不满足。搬进库之后，改价是一次后台操作 + 一分钟内生效，不用发版、不用重启。
--
-- **单行表**（id 恒为 'default'）。不做成 key-value 多行，是因为这六个数必须**一起**生效：
-- 端上按 /api/me/clip/pricing 拿到的一组数算报价，服务端按同一组数核对，差一分钱就是 409。
-- 多行表在「改了三行、另外三行还没改」的中间状态下，两边会短暂读到不同的组合。
--
-- 六列都 NOT NULL：没有「这一档没配」这回事。运营要么整组核定，要么这张表就是空的、
-- 回落 application.yml 的兜底值（与 clip_template 的 configured 语义一致）。
-- 只配其中几档会把另外几档没人核定过的占位价一并升格成「运营配过的价」。
CREATE TABLE clip_pricing (
    id VARCHAR(16) NOT NULL PRIMARY KEY,
    -- 数字人出镜，每秒
    avatar_second INT NOT NULL,
    -- 配音，每千字。全片一次取整，不按镜摊 —— 按镜摊十个短镜头能把同样字数收成十倍
    tts_per_kchar INT NOT NULL,
    -- 合成整片，每次
    assemble INT NOT NULL,
    -- 文生图，每张
    t2i_per_image INT NOT NULL,
    -- 文生视频，每秒
    t2v_second INT NOT NULL,
    -- 图生视频，每秒
    i2v_second INT NOT NULL,
    -- 谁改的、什么时候。改价是营收动作，必须能倒查
    updated_by VARCHAR(128),
    updated_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 刻意**不**插初始行。空表 = 运营没核定过 = 回落 application.yml 的值，
-- 后台据此显示「当前是配置兜底价，尚未核定」。在这里 seed 一行就等于替运营做了定价决定。
