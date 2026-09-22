# 宝塔面板安装与 HTTPS 接入总结（47.99.245.49 / yikecheng.com）

> 时间：2026-09-19，全程 SSH 操作，无需登录服务器控制台（除阿里云安全组外）。
> 结论：**是，全部步骤均可纯 SSH 完成**，面板 UI 只是可选项（见 §9 对应表）。

## 关键信息速查

| 项 | 值 |
|---|---|
| 服务器 | `root@47.99.245.49`（Alibaba Cloud Linux 3，免密 SSH） |
| 宝塔面板 | `https://bt.yikecheng.com:16375/2f4a979f`（LE 证书，无警告） |
| 面板账号 | 用户名 `rj1mcwxs`（`bt 5` 改密码，`bt default` 查信息） |
| 宝塔版本 | 12.0.0 稳定版 ＋ Nginx 1.26.3（均开机自启） |
| 站点 | 面板站点 `yikecheng.com`（含 `www`），反代 `127.0.0.1:4000` |
| 网站证书 | Let's Encrypt（双域），有效期至 2026-12-18，自动续签 |
| 安全组入方向 | `80/443 → 0.0.0.0/0`；`22/16375 → 仅自己 IP`（16375 全开则必须配 MFA＋强密码） |
| 发版流程 | 本机专用 `./deploy-yikecheng.sh`，compose 用 `docker-compose.bt.yml`（无 nginx） |
| 回滚备份 | 远端 `/root/kg_edu/docker-compose.yml.bak-bt` |

---

## 一、安装宝塔面板

官方稳定版一键脚本（root 执行）：

```bash
url=https://download.bt.cn/install/installStable_12.sh
if [ -f /usr/bin/curl ];then curl -sSO $url;else wget -O installStable_12.sh $url;fi
echo y | INSTALL_FORCE=true bash installStable_12.sh 5x59vxy56
```

两个坑（都和本机 Docker 有关）：

1. **环境检查拦截**：脚本检测到 80/443 被占用会拒绝安装。
   `echo yes |` 只能过第一关——`INSTALL_FORCE=true` 环境变量可直接跳过该检查。
2. **stdin 耗尽死循环**：脚本随后还有 `y/n` 确认，`echo yes |` 的单行输入被第一关消费完后，
   第二关 `while read` 读到 EOF 空转（CPU 100%）。正确做法是 `echo y | INSTALL_FORCE=true ...`
   一次给对：`INSTALL_FORCE` 跳第一关，`y` 留给第二关。

装完取账号并放行面板端口（本机防火墙，安全组另需在阿里云控制台放行）：

```bash
bt default   # 面板地址＋用户名＋密码（初始密码仅首次有效）
firewall-cmd --permanent --add-port=16375/tcp && firewall-cmd --reload
```

## 二、生产故障复盘（502 约 13 分钟，已恢复）

- 现象：装完面板后网站对外 502，`connect() failed (113: Host is unreachable)`，
  容器之间 TCP 全断（nginx→backend、backend→db），但宿主机→容器正常、ICMP 正常。
- 根因：宝塔安装程序改了 firewalld 并 reload，把 Docker 网桥的运行时转发状态卡死。
- 教训：**动防火墙/网络前先停业务容器，改完即测**；`firewall-cmd --reload` 后若容器互联异常，
  优先 `systemctl restart docker` 重建容器网络（本次即用此法恢复，数据无损）。
- 恢复验证：三容器 healthy、`/` 与 `/api/health` 连测 200、后端无新的 `ehostunreach`。

## 三、安装宝塔 Nginx 并建站

```bash
mkdir -p /tmp/bt-install && cd /tmp/bt-install
bash /www/server/panel/install/install_soft.sh 0 install nginx 1.26
```

- 装完因 80 被 docker 占用启动失败是**预期内**的，先不管。
- `btcli site add` 在此版本有传参 bug（错传字符串导致 `string indices must be integers`），
  绕过：直接调面板底层建站（`panelSite.AddSite`，webname 传 dict）：

```python
# /www/server/panel/pyenv/bin/python3
webname = {"domain": "yikecheng.com", "domainlist": ["www.yikecheng.com"], "count": 1}
# path=/www/wwwroot/yikecheng.com, version='00'（纯静态）, port='80'
```

## 四、反代配置（保留面板管理能力）

重写 `/www/server/panel/vhost/nginx/yikecheng.com.conf`，三条红线**勿删**，否则面板 SSL/续签失效：

1. `CERT-APPLY-CHECK` 的 well-known 引用行（证书验证用）；
2. `#SSL-START … #SSL-END` 标记块（面板写证书用）；
3. `access_log / error_log`（面板日志查看用）。

核心段（其余为面板模板原文）：

```nginx
client_max_body_size 50M;
location ^~ /.well-known/ {   # 验证目录走本地，不反代
    root /www/wwwroot/yikecheng.com;
    allow all;
}
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;       # SSE/流式输出需要
    proxy_read_timeout 300s;
}
```

- 后端无需改动（无 `force_ssl`、websocket `check_origin: false`，透传头即可）。
- 预验证：先 `listen 8080` 启动（宝塔自带的 `0.default.conf`/`phpfpm_status.conf`
  占 80，先临时挪开），`Host` 头双域测通后再切 80。

## 五、切换 80/443（约 30 秒中断）

```bash
# 1. 站点切到 80，恢复宝塔默认配置
sed -i 's/listen 8080;/listen 80;/' /www/server/panel/vhost/nginx/yikecheng.com.conf
/www/server/nginx/sbin/nginx -t
# 2. 停 docker nginx，让出端口
cd /root/kg_edu && docker compose stop nginx
# 3. 起宝塔 Nginx
/etc/init.d/nginx restart
curl -H 'Host: yikecheng.com' http://127.0.0.1/   # 200
```

- 之后从 compose 里**永久删除 nginx 服务**（两处：`/root/kg_edu/` 与 `/home/root/kg_edu/`，
  原文件留 `.bak-bt` 备份），并 `docker rm kg-edu-nginx`，防其复活抢端口。

## 六、免费证书＋强制 HTTPS（宝塔自有流程）

```python
# 1) 申请（文件验证，走 80，约 1-3 分钟）
acme_v2().apply_cert_api(id='1', domains='["yikecheng.com","www.yikecheng.com"]',
                         auth_type='http', auth_to='1')
# 2) 部署到站点
panelSite().SetSSL(siteName='yikecheng.com', key=privkey.pem, csr=fullchain.pem)
# 3) 强制跳转
panelSite().HttpToHttps(siteName='yikecheng.com')
```

- 证书落盘 `vhost/letsencrypt/yikecheng.com/`，站点用 `vhost/cert/yikecheng.com/`。
- 续签：`set_crond` 已建每日任务（`acme_v2.py --renew_v2`），证书已入库，
  到期前自动续签并重部署到站点；`.well-known` 豁免了 301，保证续签通道。
- 外网验证：`http 双域→301`，`https 双域→200`，证书链有效。

## 七、面板域名＋去警告

```bash
# 1) DNS 加 A 记录：bt.yikecheng.com → 47.99.245.49（确认解析生效后再做）
# 2) 绑定面板域名＋申请面板证书＋安装
setPanelLets().set_lets(domain='bt.yikecheng.com', email='admin@yikecheng.com',
                        auth_type='http', ca='letsencrypt')
/etc/init.d/bt restart
```

- 新地址 `https://bt.yikecheng.com:16375/2f4a979f`，信任链完整，无浏览器警告。
- **副作用**：绑定后只能用域名进面板，IP 访问返回 403（宝塔机制；本机回环不受限）。
  回滚：删 `/www/server/panel/data/domain.conf` 并 `bt restart`。
- 申请邮箱填的 `admin@yikecheng.com`（仅收过期提醒）。

## 八、发版流程重新对应（本机专用，另一台不动）

| 服务器 | 流程 | 说明 |
|---|---|---|
| 47.99.245.49（yikecheng，宝塔 HTTPS） | `./deploy-yikecheng.sh [--skip-build]`（新建） | 只同步 `docker-compose.bt.yml`（**无 nginx**）→ 重启 `backend`；不动 `.env`/数据库/宝塔/证书 |
| 124.222.177.241（智课云枢） | `deploy-zikeyunsu.sh` | **零改动** |
| 新服务器 | `deploy-kgedu.sh` | 仅加 47.99.245.49 拦截（误用即退出并指引专用脚本） |

`deploy-remote.sh` 同样加了 47.99.245.49 拦截（其它目标行为不变）。
校验均通过：`bash -n` 四个脚本 OK，`docker-compose.bt.yml` 仅含 `backend/db`。

## 九、SSH 全覆盖对应表（本次所有操作均可纯 SSH）

| 面板 UI 操作 | SSH 等价（本次实际使用） |
|---|---|
| 安装面板 | `installStable_12.sh`（§一） |
| 查账号/改密码/改端口 | `bt default`／`bt 5`／`bt 8` |
| 软件商店装 Nginx | `install_soft.sh 0 install nginx 1.26`（§三） |
| 建站 | `panelSite.AddSite`（§三，绕过 btcli bug） |
| 改站点配置 | 直接写 `vhost/nginx/*.conf`＋`nginx -t`＋`reload`（§四） |
| 申请/部署/续签证书 | `acme_v2.apply_cert_api`＋`panelSite.SetSSL`＋每日 cron（§六） |
| 强制 HTTPS 开关 | `panelSite.HttpToHttps`／`CloseToHttps`（§六） |
| 面板绑域名＋面板证书 | 写 `domain.conf`＋`setPanelLets.set_lets`（§七） |
| 放行端口（本机） | `firewall-cmd`（面板底层同源） |
| 看站点/证书状态 | `btcli site show`、读 conf、调面板 DB |

**唯一不能 SSH 的**：阿里云安全组（必须控制台点）。其余维护（发版、查日志、
续签、改配置）全部 SSH；面板浏览器仅用于“看”，非必需。

## 十、常用运维命令

```bash
ssh root@47.99.245.49
docker compose -f /root/kg_edu/docker-compose.yml ps        # 容器状态（只剩 backend+db 正常）
docker logs -f kg-edu-backend                               # 后端日志
curl -H 'Host: yikecheng.com' http://127.0.0.1/             # 站点 80 入口
curl -k -H 'Host: yikecheng.com' https://127.0.0.1/         # 站点 443 入口
/etc/init.d/nginx status; /etc/init.d/bt status             # 宝塔服务状态
bt default                                                   # 面板账号入口
```
