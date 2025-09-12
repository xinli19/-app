// 教师端入口
class TeacherApp {
  constructor() {
    this.currentUser = null;

    // 公告与提醒的分页状态
    this.annQuery = { page: 1, size: 10, ordering: "-created_at" };
    this.remQuery = { page: 1, size: 10, ordering: "-created_at" };

    this.annPage = { page: 1, size: 10, total: 0 };
    this.remPage = { page: 1, size: 10, total: 0 };

    this.announcements = [];
    this.reminders = [];

    // 折叠状态（持久化）
    this.boardCollapsedKey = "teacher_board_collapsed";
  }

  async init() {
    const ok = await Auth.routeGuard("teacher");
    if (!ok) return;

    this.currentUser = Auth.getCurrentUser();

    this.bindEvents();
    this.restoreBoardCollapsed();

    await this.loadBoard(); // 并行拉取公告与提醒

    this.setupTabs();
    this.switchTab("remindersTab");
  }

  bindEvents() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => Auth.logout());
    }

    const toggleBtn = document.getElementById("toggleBoardBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleBoard());
    }

    const refreshBtn = document.getElementById("refreshBoardBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadBoard());
    }

    // 公告分页
    const annPrevBtn = document.getElementById("annPrevBtn");
    const annNextBtn = document.getElementById("annNextBtn");
    if (annPrevBtn) {
      annPrevBtn.addEventListener("click", () => {
        if (this.annQuery.page > 1) {
          this.annQuery.page -= 1;
          this.loadAnnouncements();
        }
      });
    }
    if (annNextBtn) {
      annNextBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(this.annPage.total / this.annPage.size));
        if (this.annQuery.page < totalPages) {
          this.annQuery.page += 1;
          this.loadAnnouncements();
        }
      });
    }

    // 提醒分页
    const remPrevBtn = document.getElementById("remPrevBtn");
    const remNextBtn = document.getElementById("remNextBtn");
    if (remPrevBtn) {
      remPrevBtn.addEventListener("click", () => {
        if (this.remQuery.page > 1) {
          this.remQuery.page -= 1;
          this.loadReminders();
        }
      });
    }
    if (remNextBtn) {
      remNextBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(this.remPage.total / this.remPage.size));
        if (this.remQuery.page < totalPages) {
          this.remQuery.page += 1;
          this.loadReminders();
        }
      });
    }
  }

  restoreBoardCollapsed() {
    const saved = Utils.getStorage(this.boardCollapsedKey);
    const board = document.getElementById("teacherBoard");
    const toggleBtn = document.getElementById("toggleBoardBtn");
    const collapsed = !!saved;
    if (collapsed && board) {
      board.classList.add("collapsed");
      if (toggleBtn) toggleBtn.textContent = "展开";
    } else {
      if (toggleBtn) toggleBtn.textContent = "收起";
    }
  }

  toggleBoard() {
    const board = document.getElementById("teacherBoard");
    const toggleBtn = document.getElementById("toggleBoardBtn");
    if (!board) return;
    if (board.classList.contains("collapsed")) {
      board.classList.remove("collapsed");
      toggleBtn && (toggleBtn.textContent = "收起");
      Utils.removeStorage(this.boardCollapsedKey);
    } else {
      board.classList.add("collapsed");
      toggleBtn && (toggleBtn.textContent = "展开");
      Utils.setStorage(this.boardCollapsedKey, true, true);
    }
  }

  async loadBoard() {
    await Promise.all([this.loadAnnouncements(), this.loadReminders()]);
  }

  async loadAnnouncements() {
    const params = {
      page: this.annQuery.page,
      size: this.annQuery.size,
      ordering: this.annQuery.ordering,
    };
    try {
      const resp = await Utils.get("/api/v1/announcements/", params);
      const items = resp.results || resp || [];
      const total = resp.count ?? items.length;

      this.announcements = items;
      this.annPage = {
        page: this.annQuery.page,
        size: this.annQuery.size,
        total,
      };
      this.renderAnnouncements();
    } catch (e) {
      console.error("加载公告失败:", e);
      const wrap = document.getElementById("announcementsList");
      if (wrap) {
        wrap.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(e.message || "请稍后重试")}</div>`;
      }
    } finally {
      this.renderAnnPagination();
    }
  }

  async loadReminders() {
    const params = {
      page: this.remQuery.page,
      size: this.remQuery.size,
      ordering: this.remQuery.ordering,
      recipient_me: true,
      active: true,
    };
    try {
      const resp = await Utils.get("/api/v1/reminders/", params);
      const items = resp.results || resp || [];
      const total = resp.count ?? items.length;

      // 可选：按照紧急度排序（高->低），若后端已按时间排序，此处不强制变更
      this.reminders = items.slice();
      this.remPage = {
        page: this.remQuery.page,
        size: this.remQuery.size,
        total,
      };
      this.renderReminders();
    } catch (e) {
      console.error("加载提醒失败:", e);
      const wrap = document.getElementById("remindersList");
      if (wrap) {
        wrap.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(e.message || "请稍后重试")}</div>`;
      }
    } finally {
      this.renderRemPagination();
    }
  }

  renderAnnouncements() {
    const wrap = document.getElementById("announcementsList");
    if (!wrap) return;
    if (!this.announcements || this.announcements.length === 0) {
      wrap.innerHTML = `<div class="list-row">暂无公告</div>`;
      return;
    }
    wrap.innerHTML = this.announcements
      .map((a) => {
        const title = this.escapeHtml(a.title || `公告 #${a.id}`);
        const createdAt = this.formatDateTime(a.created_at);
        return `
          <div class="list-row">
            <div class="list-title">${title}</div>
            <div class="list-meta">
              <span>发布时间：${createdAt || "-"}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderReminders() {
    const wrap = document.getElementById("remindersList");
    if (!wrap) return;
    if (!this.reminders || this.reminders.length === 0) {
      wrap.innerHTML = `<div class="list-row">暂无提醒</div>`;
      return;
    }

    wrap.innerHTML = this.reminders
      .map((r) => {
        const createdAt = this.formatDateTime(r.created_at);
        const urgency = this.getUrgencyText(r.urgency);
        const urgencyBadge = this.getUrgencyBadge(r.urgency);
        const category = this.getReminderCategoryText(r.category);
        const senderName = this.escapeHtml(r.sender_name || r.sender || "未知发送人");
        const studentName = this.escapeHtml(r.student_name || r.student_nickname || r.student || "");
        const courseName = this.escapeHtml(r.course_name || r.course || "");
        return `
          <div class="list-row">
            <div class="list-title">
              <span class="badge ${urgencyBadge}" style="margin-right:6px;">${urgency}</span>
              ${category || "提醒"}
            </div>
            <div class="list-meta">
              <span>创建时间：${createdAt || "-"}</span>
              <span>发送人：${senderName}</span>
              ${studentName ? `<span>学员：${studentName}</span>` : ""}
              ${courseName ? `<span>课程：${courseName}</span>` : ""}
            </div>
            ${r.content ? `<div style="margin-top:6px;color:#333;">${this.escapeHtml(r.content)}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  renderAnnPagination() {
    const info = document.getElementById("annPageInfo");
    const prev = document.getElementById("annPrevBtn");
    const next = document.getElementById("annNextBtn");
    if (!info || !prev || !next) return;
    const totalPages = Math.max(1, Math.ceil(this.annPage.total / this.annPage.size));
    info.textContent = `第 ${this.annPage.page} 页 / 共 ${totalPages} 页（共 ${this.annPage.total} 条）`;
    prev.disabled = this.annPage.page <= 1;
    next.disabled = this.annPage.page >= totalPages;
  }

  renderRemPagination() {
    const info = document.getElementById("remPageInfo");
    const prev = document.getElementById("remPrevBtn");
    const next = document.getElementById("remNextBtn");
    if (!info || !prev || !next) return;
    const totalPages = Math.max(1, Math.ceil(this.remPage.total / this.remPage.size));
    info.textContent = `第 ${this.remPage.page} 页 / 共 ${totalPages} 页（共 ${this.remPage.total} 条）`;
    prev.disabled = this.remPage.page <= 1;
    next.disabled = this.remPage.page >= totalPages;
  }

  // ------- 小工具 -------
  formatDateTime(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return str;
    }
  }
  getUrgencyText(value) {
    switch (String(value || "")) {
      case "high":
      case "urgent":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return "一般";
    }
  }
  getUrgencyBadge(value) {
    switch (String(value || "")) {
      case "high":
      case "urgent":
        return "badge-danger";
      case "medium":
        return "badge-warning";
      case "low":
        return "badge-info";
      default:
        return "badge-secondary";
    }
  }
  getReminderCategoryText(value) {
    const map = {
      performance_poor: "教学效果差",
      attitude_problem: "态度问题",
      irregular_return: "回课不规律",
      injury: "有伤病",
      live_suggestion: "直播建议",
      other: "其他",
    };
    return map[String(value || "")] || "提醒";
  }
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

// 启动
document.addEventListener("DOMContentLoaded", () => {
  const app = new TeacherApp();
  app.init();
});