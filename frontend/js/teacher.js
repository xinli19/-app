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
    this.roleMembersCache = { researcher: null, operator: null }; // 角色->成员列表缓存
    this.fbQuery = { page: 1, size: 20, ordering: "-created_at" }; // 我的点评历史
    this.feedbacks = [];
    this.fbPage = { page: 1, size: 20, total: 0 };
    this._fbLoadedOnce = false; // 首次进入“查看点评”时自动加载一次
    // 折叠状态（持久化）
    this.boardCollapsedKey = "teacher_board_collapsed";
    this.remInbQuery = { page: 1, size: 10, ordering: "-created_at", q: "" };
    this.remInbPage = { page: 1, size: 10, total: 0 };
    this.inboxReminders = [];
    this.inbSelectedIds = new Set();

    // 新增：点评任务列表状态
    this.taskQuery = { page: 1, size: 10, ordering: "-created_at", status: "" };
    this.taskPage = { page: 1, size: 10, total: 0 };
    this.tasks = [];
    // 新增：当前正在编辑点评的任务ID（行内编辑）
    this.editingTaskId = null;
  }

  async init() {
    const ok = await Auth.routeGuard("teacher");
    if (!ok) return;

    this.currentUser = Auth.getCurrentUser();

    this.bindEvents();
    this.restoreBoardCollapsed();

    await this.loadBoard(); // 并行拉取公告与提醒

    this.setupTabs();
    // 修复：默认打开“点评任务”页签，避免和“教师提醒”同时可见
    this.switchTab("tasksTab");

    this.loadInboxReminders().catch(console.error);
    this.loadTasks().catch(console.error);
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
        const totalPages = Math.max(
          1,
          Math.ceil(this.annPage.total / this.annPage.size)
        );
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
        const totalPages = Math.max(
          1,
          Math.ceil(this.remPage.total / this.remPage.size)
        );
        if (this.remQuery.page < totalPages) {
          this.remQuery.page += 1;
          this.loadReminders();
        }
      });
    }

    // ===== 教师提醒（tab）事件绑定 =====
    const remInbSearchBtn = document.getElementById("remInbSearchBtn");
    const remInbRefreshBtn = document.getElementById("remInbRefresh");
    const remInbPrevBtn = document.getElementById("remInbPrev");
    const remInbNextBtn = document.getElementById("remInbNext");
    const remSelectAll = document.getElementById("remInbSelectAll");
    const remInbMarkReadBtn = document.getElementById(
      "remInbMarkReadSelectedBtn"
    );
    const remList = document.getElementById("remInbList");

    if (remInbSearchBtn) {
      remInbSearchBtn.addEventListener("click", () => {
        const kw = (document.getElementById("remInbQ")?.value || "").trim();
        this.remInbQuery.q = kw;
        this.remInbQuery.page = 1;
        this.loadInboxReminders();
      });
    }
    if (remInbRefreshBtn) {
      remInbRefreshBtn.addEventListener("click", () =>
        this.loadInboxReminders()
      );
    }
    if (remInbPrevBtn) {
      remInbPrevBtn.addEventListener("click", () => {
        if (this.remInbQuery.page > 1) {
          this.remInbQuery.page -= 1;
          this.loadInboxReminders();
        }
      });
    }
    if (remInbNextBtn) {
      remInbNextBtn.addEventListener("click", () => {
        const totalPages = Math.max(
          1,
          Math.ceil(this.remInbPage.total / this.remInbPage.size)
        );
        if (this.remInbQuery.page < totalPages) {
          this.remInbQuery.page += 1;
          this.loadInboxReminders();
        }
      });
    }
    if (remSelectAll) {
      remSelectAll.addEventListener("change", (e) => {
        const checked = !!e.target.checked;
        const boxes =
          remList?.querySelectorAll('input.inb-check[type="checkbox"]') || [];
        boxes.forEach((cb) => {
          cb.checked = checked;
          const id = cb.dataset.id;
          if (!id) return;
          if (checked) this.inbSelectedIds.add(String(id));
          else this.inbSelectedIds.delete(String(id));
        });
      });
    }
    if (remInbMarkReadBtn) {
      remInbMarkReadBtn.addEventListener("click", () =>
        this.markReadSelected()
      );
    }
    if (remList) {
      // 单条选择/取消选择
      remList.addEventListener("change", (e) => {
        const t = e.target;
        if (t && t.classList?.contains("inb-check")) {
          const id = String(t.dataset.id || "");
          if (!id) return;
          if (t.checked) this.inbSelectedIds.add(id);
          else this.inbSelectedIds.delete(id);
        }
      });
    }

    // ===== 点评任务事件绑定 =====
    const tasksRefresh = document.getElementById("tasksRefresh");
    const tasksStatusFilter = document.getElementById("taskStatusFilter");
    const tasksPrev = document.getElementById("tasksPrev");
    const tasksNext = document.getElementById("tasksNext");
    const tasksList = document.getElementById("tasksList");

    if (tasksStatusFilter) {
      tasksStatusFilter.addEventListener("change", (e) => {
        this.taskQuery.status = e.target.value || "";
        this.taskQuery.page = 1;
        this.loadTasks();
      });
    }

    if (tasksPrev) {
      tasksPrev.addEventListener("click", () => {
        if (this.taskQuery.page > 1) {
          this.taskQuery.page -= 1;
          this.loadTasks();
        }
      });
    }
    if (tasksNext) {
      tasksNext.addEventListener("click", () => {
        const totalPages = Math.max(
          1,
          Math.ceil(this.taskPage.total / this.taskPage.size)
        );
        if (this.taskQuery.page < totalPages) {
          this.taskQuery.page += 1;
          this.loadTasks();
        }
      });
    }

    if (tasksList) {
      // 列表内点击事件：学员锚点、提交点评、切换印象/提醒、发送提醒
      tasksList.addEventListener("click", (e) => {
        // 学员昵称（锚点）
        const stuLink = e.target.closest(".stu-link");
        if (stuLink) {
          e.preventDefault();
          const sid = stuLink.dataset.stuId;
          if (sid) this.openStudentModal(sid);
          return;
        }

        const submitBtn = e.target.closest(".btn-submit-feedback");
        if (submitBtn) {
          const id = submitBtn.dataset.id;
          if (id) this.submitTask(id);
          return;
        }

        const toggleImpBtn = e.target.closest(".btn-toggle-impression");
        if (toggleImpBtn) {
          const id = toggleImpBtn.dataset.id;
          if (id) this.toggleImpression(id);
          return;
        }

        const toggleRemBtn = e.target.closest(".btn-toggle-reminder");
        if (toggleRemBtn) {
          const id = toggleRemBtn.dataset.id;
          if (id) this.toggleReminder(id);
          return;
        }

        const sendRemBtn = e.target.closest(".btn-send-reminder");
        if (sendRemBtn) {
          const id = sendRemBtn.dataset.id;
          if (id) this.pushReminder(id);
          return;
        }
      });

      // 列表内控件变化：角色选择变更后刷新接收人多选
      tasksList.addEventListener("change", async (e) => {
        if (e.target && e.target.classList?.contains("rem-role")) {
          const taskId = e.target.dataset.id;
          const role = e.target.value;
          await this.populateRecipientsSelect(taskId, role);
        }
      });

      // 点评内容字数统计
      tasksList.addEventListener("input", (e) => {
        if (e.target && e.target.classList?.contains("task-editor")) {
          const id = e.target.dataset.id;
          const counter = document.getElementById(`task-char-${id}`);
          if (counter) counter.textContent = String(e.target.value.length || 0);
        }
      });
    }

    // ===== 查看点评（tab）事件绑定 =====
    const fbSearchBtn = document.getElementById("fbSearchBtn");
    const fbRefreshBtn = document.getElementById("fbRefresh");
    const fbPrevBtn = document.getElementById("fbPrev");
    const fbNextBtn = document.getElementById("fbNext");

    if (fbSearchBtn) {
      fbSearchBtn.addEventListener("click", () => {
        this.fbQuery.page = 1;
        this.loadFeedbacks().catch(console.error);
      });
    }
    if (fbRefreshBtn) {
      fbRefreshBtn.addEventListener("click", () => {
        this.loadFeedbacks().catch(console.error);
      });
    }
    if (fbPrevBtn) {
      fbPrevBtn.addEventListener("click", () => {
        if (this.fbQuery.page > 1) {
          this.fbQuery.page -= 1;
          this.loadFeedbacks().catch(console.error);
        }
      });
    }
    if (fbNextBtn) {
      fbNextBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(this.fbPage.total / this.fbPage.size));
        if (this.fbQuery.page < totalPages) {
          this.fbQuery.page += 1;
          this.loadFeedbacks().catch(console.error);
        }
      });
    }
  }
async loadTasks() {
    const list = document.getElementById("tasksList");
    if (list) list.innerHTML = `<div class="list-row">加载中...</div>`;

    const params = {
      page: this.taskQuery.page,
      size: this.taskQuery.size,
      ordering: this.taskQuery.ordering,
      assignee_me: true,
    };
    if (this.taskQuery.status) params.status = this.taskQuery.status;

    try {
      // 统一使用 /api/v1/tasks/
      const resp = await Utils.get("/api/v1/tasks/", params);
      const items = resp.results || resp || [];
      const total = resp.count ?? items.length;
      this.tasks = items;
      this.taskPage = {
        page: this.taskQuery.page,
        size: this.taskQuery.size,
        total,
      };
      this.renderTasksList();
    } catch (e) {
      console.error("加载点评任务失败:", e);
      if (list)
        list.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(
          e.message || "请稍后重试"
        )}</div>`;
    } finally {
      this.renderTasksPagination();
    }
  }
  renderTasksList() {
    const container = document.getElementById("tasksList");
    if (!container) return;
    if (!this.tasks || this.tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无任务</h3>
          <p>切换状态筛选或稍后刷新重试</p>
        </div>`;
      return;
    }
    container.innerHTML = this.tasks
      .map((t) => {
        const statusBadge =
          t.status === "completed"
            ? '<span class="badge badge-success">已完成</span>'
            : '<span class="badge badge-warning">未完成</span>';
        const createdAt = t.created_at ? this.formatDateTime(t.created_at) : "";
        const updatedAt = t.updated_at ? this.formatDateTime(t.updated_at) : "";
        const studentName = this.escapeHtml(
          t.student_nickname || t.student || ""
        );
        const assigneeName = this.escapeHtml(
          t.assignee_name || t.assignee || ""
        );
        const note = t.note ? this.escapeHtml(t.note) : "<em>无备注</em>";

        // 行内：教师点评输入框（始终显示）
        const editor =
          t.status !== "completed"
            ? `
      <div class="task-editor-wrap" style="margin-top:8px;">
        <textarea id="task-editor-${t.id}" class="task-editor" data-id="${t.id}" rows="4" placeholder="请输入教师点评内容（必填）"></textarea>
        <div class="editor-actions" style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="char-counter">已输入 <span id="task-char-${t.id}">0</span> 字</span>
          <button class="btn btn-success btn-submit-feedback" data-id="${t.id}">提交点评</button>
          <button class="btn btn-secondary btn-toggle-impression" data-id="${t.id}">填写教师印象</button>
          <button class="btn btn-info btn-toggle-reminder" data-id="${t.id}">推送提醒</button>
        </div>
      </div>
      <!-- 教师印象编辑区（默认隐藏） -->
      <div id="imp-wrap-${t.id}" class="impression-wrap" style="display:none;margin-top:8px;padding:8px;border:1px dashed #ccc;border-radius:4px;">
        <!-- ... existing code ... -->
      </div>
      <!-- 推送提醒编辑区（默认隐藏） -->
      <div id="rem-wrap-${t.id}" class="reminder-wrap" style="display:none;margin-top:8px;padding:8px;border:1px dashed #ccc;border-radius:4px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <label>推送给：</label>
          <select id="rem-role-${t.id}" class="rem-role" data-id="${t.id}" style="min-width:120px;padding:6px;">
            <option value="researcher">教研</option>
            <option value="operator">运营</option>
          </select>
          <select id="rem-recipients-${t.id}" class="rem-recipients" data-id="${t.id}" multiple size="4" style="min-width:220px;padding:6px;"></select>
          <span style="color:#888;">（按角色筛选多选接收人，至少选择 1 位）</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <select id="rem-urgency-${t.id}" style="min-width:120px;padding:6px;">
            <option value="normal">一般</option>
            <option value="medium">中</option>
            <option value="urgent">高</option>
          </select>
          <span style="color:#888;">紧急度</span>
        </div>
        <textarea id="rem-content-${t.id}" rows="3" placeholder="请输入提醒内容（例如：该生最近练习不规律，请关注）" style="width:100%;padding:6px;"></textarea>
        <div style="margin-top:6px;">
          <button class="btn btn-primary btn-send-reminder" data-id="${t.id}">发送提醒</button>
        </div>
      </div>
    `
            : `
      <div style="margin-top:8px;color:#888;">该任务已完成，无法再次提交。</div>
    `;
        return `
          <div class="evaluation-item">
            <div class="evaluation-meta">
              <div>
                <strong>学员：</strong>${studentName}
                &nbsp;&nbsp;<strong>负责人：</strong>${assigneeName}
                &nbsp;&nbsp;<strong>状态：</strong>${statusBadge}
              </div>
              <div class="secondary">
                <span>创建：${createdAt}</span>
                &nbsp;&nbsp;<span>更新：${updatedAt}</span>
              </div>
            </div>
            <div class="evaluation-content">
              ${note}
              ${editor}
            </div>
          </div>
        `;
      })
      .join("");
  }
  // 切换“教师印象”编辑区
  toggleImpression(taskId) {
    const el = document.getElementById(`imp-wrap-${taskId}`);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
  }

  // 切换“推送提醒”编辑区
  toggleReminder(taskId) {
    const el = document.getElementById(`rem-wrap-${taskId}`);
    if (!el) return;
    const nowShow = el.style.display === "none";
    el.style.display = nowShow ? "block" : "none";
    if (nowShow) {
      // 初次展开时，按默认角色加载成员
      const roleSel = document.getElementById(`rem-role-${taskId}`);
      const role = roleSel?.value || "researcher";
      this.populateRecipientsSelect(taskId, role);
    }
  }

  // 提交点评（附带可选的教师印象）
  async submitTask(taskId) {
    try {
      const ta = document.getElementById(`task-editor-${taskId}`);
      const content = (ta?.value || "").trim();
      if (!content) {
        alert("请先填写教师点评内容");
        return;
      }
      if (content.length < 5) {
        alert("点评内容至少需要 5 个字");
        return;
      }

      // 读取教师印象（可选）
      const impWrap = document.getElementById(`imp-wrap-${taskId}`);
      let body = { teacher_content: content };
      if (impWrap && impWrap.style.display !== "none") {
        const enable = !!document.getElementById(`imp-enable-${taskId}`)
          ?.checked;
        const text = (
          document.getElementById(`imp-text-${taskId}`)?.value || ""
        ).trim();
        if (enable) {
          body.produce_impression = true;
          body.impression_text = text || "";
        }
      }

      await Utils.request(`/api/v1/tasks/${taskId}/submit/`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      await this.loadTasks();
    } catch (e) {
      const msg = String(e.message || "");
      if (msg.includes("HTTP 501")) {
        alert(
          "后端暂未实现提交接口（/api/v1/tasks/:id/submit/），功能待对接完成后可使用。"
        );
        return;
      }
      console.error("提交点评失败:", e);
      alert(e.message || "提交失败，请稍后重试");
    }
  }
  // 推送提醒（发送到当前教师的收件箱）
  async pushReminder(taskId) {
    try {
      const task = this.tasks.find((x) => String(x.id) === String(taskId));
      if (!task) {
        alert("未找到任务数据，请刷新后重试");
        return;
      }
      const content = (
        document.getElementById(`rem-content-${taskId}`)?.value || ""
      ).trim();
      const urgency =
        document.getElementById(`rem-urgency-${taskId}`)?.value || "normal";
      if (!content) {
        alert("请先填写提醒内容");
        return;
      }

      // 关键：需要 sender（发送人）与 receiver（接收人）为有效的人员ID
      const mePersonId = this.getCurrentPersonId();
      if (!mePersonId) {
        // 账号未绑定人员 -> 无法创建提醒（后端要求sender）
        alert("当前账号未绑定人员，请联系管理员在后台为账号绑定人员后再试。");
        return;
      }

      // 兼容后端 student 返回为 ID 或对象两种情况
      const studentId =
        typeof task.student === "object" && task.student
          ? task.student.id ?? null
          : task.student;

      await Utils.request("/api/v1/reminders/", {
        method: "POST",
        body: JSON.stringify({
          content,
          urgency,
          category: "other",
          student: studentId || null,
          // 显式传入 sender，避免 400
          sender: mePersonId,
          // 默认把提醒推送给自己（后续再支持选择接收人）
          receiver: mePersonId,
        }),
      });

      alert("提醒已发送到你的收件箱");
      const ta = document.getElementById(`rem-content-${taskId}`);
      if (ta) ta.value = "";
    } catch (e) {
      console.error("发送提醒失败:", e);
      alert(e.message || "发送提醒失败，请稍后重试");
    }
  }

  async startTask(taskId) {
    // 已取消“先点按钮再展开”的交互，此方法保留以兼容旧调用，不做实际操作
    return;
  }
  switchSection(sectionKey) {
    // ... existing code ...
    // 切换显示
    this.switchTab(targetId);

    // 新增：切换时拉取对应数据
    switch (sectionKey) {
      case "reminders":
        this.loadInboxReminders();
        break;
      case "tasks":
        this.loadTasks();
        break;
      default:
        break;
    }
  }
  // ===== 教师提醒（tab）对接后台 =====
  async loadInboxReminders() {
    const list = document.getElementById("remInbList");
    if (list) list.innerHTML = `<div class="list-row">加载中...</div>`;

    const params = {
      page: this.remInbQuery.page,
      size: this.remInbQuery.size,
      ordering: this.remInbQuery.ordering,
      recipient_me: true,
      active: true,
    };
    if (this.remInbQuery.q) params.search = this.remInbQuery.q;

    try {
      const resp = await Utils.get("/api/v1/reminders/", params);
      const items = resp.results || resp || [];
      const total = resp.count ?? items.length;
      this.inboxReminders = items;
      this.remInbPage = {
        page: this.remInbQuery.page,
        size: this.remInbQuery.size,
        total,
      };
      this.renderInboxReminders();
    } catch (e) {
      console.error("加载教师提醒失败:", e);
      if (list)
        list.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(
          e.message || "请稍后重试"
        )}</div>`;
    } finally {
      this.renderRemInbPagination();
    }
  }

  renderInboxReminders() {
    const wrap = document.getElementById("remInbList");
    if (!wrap) return;
    if (!this.inboxReminders || this.inboxReminders.length === 0) {
      wrap.innerHTML = `<div class="list-row">暂无提醒</div>`;
      return;
    }
    wrap.innerHTML = this.inboxReminders
      .map((r) => {
        const id = r.id;
        const createdAt = this.formatDateTime(r.created_at);
        const urgency = this.getUrgencyText(r.urgency);
        const urgencyBadge = this.getUrgencyBadge(r.urgency);
        const category = this.getReminderCategoryText(r.category);
        const senderName = this.escapeHtml(
          r.sender_name || r.sender || "未知发送人"
        );
        const studentName = this.escapeHtml(
          r.student_name || r.student_nickname || r.student || ""
        );
        const courseName = this.escapeHtml(r.course_name || r.course || "");
        const checked = this.inbSelectedIds.has(String(id)) ? "checked" : "";
        return `
          <div class="list-row">
            <div class="list-title" style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" class="inb-check" data-id="${id}" ${checked} />
              <span class="badge ${urgencyBadge}" style="margin-right:6px;">${urgency}</span>
              ${category || "提醒"}
            </div>
            <div class="list-meta">
              <span>创建时间：${createdAt || "-"}</span>
              <span>发送人：${senderName}</span>
              ${studentName ? `<span>学员：${studentName}</span>` : ""}
              ${courseName ? `<span>课程：${courseName}</span>` : ""}
            </div>
            ${
              r.content
                ? `<div style="margin-top:6px;color:#333;">${this.escapeHtml(
                    r.content
                  )}</div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }
  renderRemInbPagination() {
    const info = document.getElementById("remInbPageInfo");
    const prev = document.getElementById("remInbPrev");
    const next = document.getElementById("remInbNext");
    if (!info || !prev || !next) return;
    const totalPages = Math.max(
      1,
      Math.ceil(this.remInbPage.total / this.remInbPage.size)
    );
    info.textContent = `第 ${this.remInbPage.page} 页 / 共 ${totalPages} 页（共 ${this.remInbPage.total} 条）`;
    prev.disabled = this.remInbPage.page <= 1;
    next.disabled = this.remInbPage.page >= totalPages;
  }

  async markReadSelected() {
    const ids = Array.from(this.inbSelectedIds);
    if (ids.length === 0) {
      alert("请先勾选需要标记为已读的提醒");
      return;
    }
    try {
      await Utils.request("/api/v1/reminders/read-bulk", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      // 清除选择并刷新
      this.inbSelectedIds.clear();
      const selAll = document.getElementById("remInbSelectAll");
      if (selAll) selAll.checked = false;
      await this.loadInboxReminders();
    } catch (e) {
      console.error("批量标记已读失败:", e);
      alert(e.message || "标记失败，请稍后重试");
    }
  }
  async loadTasks() {
    const list = document.getElementById("tasksList");
    if (list) list.innerHTML = `<div class="list-row">加载中...</div>`;

    const params = {
      page: this.taskQuery.page,
      size: this.taskQuery.size,
      ordering: this.taskQuery.ordering,
      assignee_me: true,
    };
    if (this.taskQuery.status) params.status = this.taskQuery.status;

    try {
      // 统一使用 /api/v1/tasks/
      const resp = await Utils.get("/api/v1/tasks/", params);
      const items = resp.results || resp || [];
      const total = resp.count ?? items.length;
      this.tasks = items;
      this.taskPage = {
        page: this.taskQuery.page,
        size: this.taskQuery.size,
        total,
      };
      this.renderTasksList();
    } catch (e) {
      console.error("加载点评任务失败:", e);
      if (list)
        list.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(
          e.message || "请稍后重试"
        )}</div>`;
    } finally {
      this.renderTasksPagination();
    }
  }

  renderTasksList() {
    const container = document.getElementById("tasksList");
    if (!container) return;
    if (!this.tasks || this.tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无任务</h3>
          <p>切换状态筛选或稍后刷新重试</p>
        </div>`;
      return;
    }
    container.innerHTML = this.tasks
      .map((t) => {
        const statusBadge =
          t.status === "completed"
            ? '<span class="badge badge-success">已完成</span>'
            : '<span class="badge badge-warning">未完成</span>';
        const createdAt = t.created_at ? this.formatDateTime(t.created_at) : "";
        const updatedAt = t.updated_at ? this.formatDateTime(t.updated_at) : "";
        const rawStudentName = t.student_nickname || t.student || "";
        const assigneeName = this.escapeHtml(
          t.assignee_name || t.assignee || ""
        );
        const note = t.note ? this.escapeHtml(t.note) : "<em>无备注</em>";

        // 学员昵称：可点击打开学员详情
        const studentId =
          typeof t.student === "object" && t.student ? (t.student.id ?? null) : t.student;
        const studentNameHtml = studentId
          ? `<a href="#" class="stu-link" data-stu-id="${studentId}">${this.escapeHtml(rawStudentName)}</a>`
          : this.escapeHtml(rawStudentName);

        // 行内：教师点评输入框（始终显示）
        const editor =
          t.status !== "completed"
            ? `
          <div class="task-editor-wrap" style="margin-top:8px;">
            <textarea id="task-editor-${t.id}" class="task-editor" data-id="${t.id}" rows="4" placeholder="请输入教师点评内容（必填）"></textarea>
            <div class="editor-actions" style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="char-counter">已输入 <span id="task-char-${t.id}">0</span> 字</span>
              <button class="btn btn-success btn-submit-feedback" data-id="${t.id}">提交点评</button>
              <button class="btn btn-secondary btn-toggle-impression" data-id="${t.id}">填写教师印象</button>
              <button class="btn btn-info btn-toggle-reminder" data-id="${t.id}">推送提醒</button>
            </div>
          </div>
          <!-- 教师印象编辑区（默认隐藏） -->
          <div id="imp-wrap-${t.id}" class="impression-wrap" style="display:none;margin-top:8px;padding:8px;border:1px dashed #ccc;border-radius:4px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:4px;">
                <input type="checkbox" id="imp-enable-${t.id}" />
                产出教师印象
              </label>
              <input type="text" id="imp-text-${t.id}" placeholder="请输入教师印象内容" style="flex:1;min-width:220px;padding:6px;"/>
            </div>
            <div class="hint" style="color:#888;margin-top:6px;">不勾选则不产出教师印象；勾选后建议填写简短的印象摘要。</div>
          </div>
          <!-- 推送提醒编辑区（默认隐藏） -->
          <div id="rem-wrap-${t.id}" class="reminder-wrap" style="display:none;margin-top:8px;padding:8px;border:1px dashed #ccc;border-radius:4px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <select id="rem-urgency-${t.id}" style="min-width:120px;padding:6px;">
                <option value="normal">一般</option>
                <option value="medium">中</option>
                <option value="urgent">高</option>
              </select>
              <span style="color:#888;">紧急度</span>
            </div>
            <textarea id="rem-content-${t.id}" rows="3" placeholder="请输入提醒内容（例如：该生最近练习不规律，请关注）" style="width:100%;padding:6px;"></textarea>
            <div style="margin-top:6px;">
              <button class="btn btn-primary btn-send-reminder" data-id="${t.id}">发送提醒到我的收件箱</button>
              <span style="color:#888;margin-left:8px;">（接收人默认是当前登录教师，可在后续版本支持选择对象）</span>
            </div>
          </div>
        `
            : `
          <div style="margin-top:8px;color:#888;">该任务已完成，无法再次提交。</div>
        `;

        return `
          <div class="evaluation-item">
            <div class="evaluation-meta">
              <div>
                <strong>学员：</strong>${studentNameHtml}
                &nbsp;&nbsp;<strong>负责人：</strong>${assigneeName}
                &nbsp;&nbsp;<strong>状态：</strong>${statusBadge}
              </div>
              <div class="secondary">
                <span>创建：${createdAt}</span>
                &nbsp;&nbsp;<span>更新：${updatedAt}</span>
              </div>
            </div>
            <div class="evaluation-content">
              ${note}
              ${editor}
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderTasksPagination() {
    const info = document.getElementById("tasksPageInfo");
    const prev = document.getElementById("tasksPrev");
    const next = document.getElementById("tasksNext");
    if (!info || !prev || !next) return;
    const totalPages = Math.max(
      1,
      Math.ceil(this.taskPage.total / this.taskPage.size)
    );
    info.textContent = `第 ${this.taskPage.page} 页 / 共 ${totalPages} 页（共 ${this.taskPage.total} 条）`;
    prev.disabled = this.taskPage.page <= 1;
    next.disabled = this.taskPage.page >= totalPages;
  }

  // ===== 教师点评历史（tab）对接后台 =====
  async loadFeedbacks() {
    try {
      const q = (document.getElementById("fbQ")?.value || "").trim();
      const start = (document.getElementById("fbStart")?.value || "").trim(); // YYYY-MM-DD
      const end = (document.getElementById("fbEnd")?.value || "").trim();

      const params = {
        page: this.fbQuery.page,
        size: this.fbQuery.size,
        ordering: this.fbQuery.ordering,
        teacher_me: true, // 默认“只看我的点评”
      };
      if (q) params.q = q;
      if (start) params.start = start;
      if (end) params.end = end;

      const resp = await Utils.get("/api/v1/feedbacks/", params);
      this.feedbacks = Array.isArray(resp?.items) ? resp.items : [];
      this.fbPage = {
        page: Number(resp?.page) || this.fbQuery.page,
        size: Number(resp?.size) || this.fbQuery.size,
        total: Number(resp?.total) || 0,
      };
      this.renderFeedbacks();
      this.renderFbPagination();
    } catch (e) {
      console.error("加载点评记录失败:", e);
      const container = document.getElementById("fbList");
      if (container) {
        container.innerHTML = `<div class="empty">加载失败，请稍后重试</div>`;
      }
    }
  }

  renderFeedbacks() {
    const container = document.getElementById("fbList");
    if (!container) return;

    if (!this.feedbacks.length) {
      container.innerHTML = `<div class="empty">暂无点评记录。可尝试调整搜索条件或稍后刷新。</div>`;
      return;
    }

    container.innerHTML = this.feedbacks
      .map((it) => {
        const student = this.escapeHtml(it.student_nickname || "-");
        const teacher = this.escapeHtml(it.teacher_name || "-");
        const created = this.formatDateTime(it.created_at);
        const taskStatus = this.escapeHtml(it.task_status || "-");
        const teacherContent = this.escapeHtml(it.content_text || it.teacher_content || "");
        const researcherFeedback = this.escapeHtml(it.researcher_feedback || "");

        return `
          <div class="card" style="margin-bottom:10px;">
            <div class="card-header">
              <span><strong>学员：</strong>${student}</span>
              <span style="margin-left:12px;"><strong>教师：</strong>${teacher}</span>
              <span style="margin-left:12px;"><strong>创建时间：</strong>${created}</span>
              <span style="margin-left:12px;"><strong>任务状态：</strong>${taskStatus}</span>
            </div>
            <div class="card-body">
              <div><strong>教师点评：</strong>${teacherContent || "-"}</div>
              <div style="margin-top:6px;"><strong>教研反馈：</strong>${researcherFeedback || "-"}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderFbPagination() {
    const info = document.getElementById("fbPageInfo");
    const prev = document.getElementById("fbPrev");
    const next = document.getElementById("fbNext");
    if (!info || !prev || !next) return;

    const totalPages = Math.max(1, Math.ceil(this.fbPage.total / this.fbPage.size));
    info.textContent = `第 ${this.fbPage.page} 页 / 共 ${totalPages} 页（共 ${this.fbPage.total} 条）`;
    prev.disabled = this.fbPage.page <= 1;
    next.disabled = this.fbPage.page >= totalPages;
  }

  async startTask(taskId) {
    // 改为：仅切换为编辑态，不调用后端 start
    this.editingTaskId = String(taskId);
    this.renderTasksList();
  }

  // 新增：当前用户 personId 识别（用于任务负责人筛选）
  getCurrentPersonId() {
    const u = this.currentUser || {};
    return (u.person && u.person.id) ?? u.person_id ?? null;
  }

  // 新增：角色成员获取与接收人选择填充
  async fetchRoleMembers(role) {
    if (this.roleMembersCache[role]) return this.roleMembersCache[role];
    const params = { role, size: 500 };
    const resp = await Utils.get("/api/v1/person-roles/", params);
    const items = resp.results || resp || [];
    const list = items.map((x) => ({
      id: x.person,
      name: x.person_name || x.person,
    }));
    this.roleMembersCache[role] = list;
    return list;
  }

  async populateRecipientsSelect(taskId, role) {
    const sel = document.getElementById(`rem-recipients-${taskId}`);
    if (!sel) return;
    sel.innerHTML = `<option disabled>加载中...</option>`;
    try {
      const members = await this.fetchRoleMembers(role);
      sel.innerHTML = members
        .map((m) => `<option value='${m.id}'>${this.escapeHtml(m.name)}</option>`)
        .join("");
    } catch (e) {
      console.error("加载角色成员失败:", e);
      sel.innerHTML = `<option disabled>加载失败</option>`;
    }
  }
  // 新增：导航/选项卡初始化（参考教研页）
  setupTabs() {
    // 顶部导航栏（nav-link）
    const navLinks = document.querySelectorAll(".nav-link[data-section]");
    if (navLinks.length) {
      navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const section = link.dataset.section; // reminders | tasks | feedbacks
          this.switchSection(section);
        });
      });
    }

    // 兼容：若仍保留 tab-btn（不影响导航）
    const tabBtns = document.querySelectorAll("#teacherTabs .tab-btn");
    if (tabBtns.length) {
      tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = btn.dataset.tab; // remindersTab | tasksTab | feedbacksTab
          this.switchTab(targetId);
          tabBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });
    }
  }

  // 新增：按“导航项”切换模块
  switchSection(sectionKey) {
    // sectionKey -> 现有 section id 的映射
    const map = {
      reminders: "remindersTab",
      tasks: "tasksTab",
      feedbacks: "feedbacksTab",
    };
    const targetId = map[sectionKey] || "remindersTab";

    // 更新导航高亮
    document
      .querySelectorAll("#teacherNav .nav-item")
      .forEach((li) => li.classList.remove("active"));
    const activeLink = document.querySelector(
      `#teacherNav .nav-link[data-section="${sectionKey}"]`
    );
    activeLink?.parentElement?.classList.add("active");

    // 切换显示
    this.switchTab(targetId);

    // 切换时拉取对应数据
    switch (sectionKey) {
      case "reminders":
        this.loadInboxReminders();
        break;
      case "tasks":
        this.loadTasks();
        break;
      case "feedbacks":
        // 首次进入已在 switchTab 中处理，这里若已加载过则刷新
        if (this._fbLoadedOnce) {
          this.loadFeedbacks();
        }
        break;
      default:
        break;
    }
  }

  // 新增：按具体 section id 切换显示
  switchTab(targetId) {
    const allIds = ["remindersTab", "tasksTab", "feedbacksTab"];
    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = id === targetId ? "block" : "none";
    });

    // 首次进入“查看点评”时自动加载一次
    if (targetId === "feedbacksTab" && !this._fbLoadedOnce) {
      this._fbLoadedOnce = true;
      this.loadFeedbacks();
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
        wrap.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(
          e.message || "请稍后重试"
        )}</div>`;
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
        wrap.innerHTML = `<div class="list-row">加载失败：${this.escapeHtml(
          e.message || "请稍后重试"
        )}</div>`;
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
        const senderName = this.escapeHtml(
          r.sender_name || r.sender || "未知发送人"
        );
        const studentName = this.escapeHtml(
          r.student_name || r.student_nickname || r.student || ""
        );
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
            ${
              r.content
                ? `<div style="margin-top:6px;color:#333;">${this.escapeHtml(
                    r.content
                  )}</div>`
                : ""
            }
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
    const totalPages = Math.max(
      1,
      Math.ceil(this.annPage.total / this.annPage.size)
    );
    info.textContent = `第 ${this.annPage.page} 页 / 共 ${totalPages} 页（共 ${this.annPage.total} 条）`;
    prev.disabled = this.annPage.page <= 1;
    next.disabled = this.annPage.page >= totalPages;
  }

  renderRemPagination() {
    const info = document.getElementById("remPageInfo");
    const prev = document.getElementById("remPrevBtn");
    const next = document.getElementById("remNextBtn");
    if (!info || !prev || !next) return;
    const totalPages = Math.max(
      1,
      Math.ceil(this.remPage.total / this.remPage.size)
    );
    info.textContent = `第 ${this.remPage.page} 页 / 共 ${totalPages} 页（共 ${this.remPage.total} 条）`;
    prev.disabled = this.remPage.page <= 1;
    next.disabled = this.remPage.page >= totalPages;
  }

  // ===== 学员详情弹窗 =====
  async openStudentModal(studentId) {
    if (!studentId) return;

    // 创建或获取弹窗容器
    let modal = document.getElementById("studentInfoModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "studentInfoModal";
      modal.innerHTML = `
        <div class="student-modal-backdrop" style="
          position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9998;
        "></div>
        <div class="student-modal" style="
          position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%);
          width: 720px; max-width: 94vw; max-height: 80vh; overflow: auto;
          background: #fff; border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.2);
          z-index: 9999; padding: 16px 20px;
        ">
          <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:18px;">学员信息</h3>
            <button id="studentModalCloseBtn" class="btn btn-small btn-secondary">关闭</button>
          </div>
          <div id="studentModalBody" style="margin-top:12px;">
            <div>加载中...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // 关闭事件
      const closeBtn = modal.querySelector("#studentModalCloseBtn");
      const backdrop = modal.querySelector(".student-modal-backdrop");
      closeBtn?.addEventListener("click", () => this.hideStudentModal());
      backdrop?.addEventListener("click", () => this.hideStudentModal());
      // ESC 关闭
      this._studentEscHandler = (e) => {
        if (e.key === "Escape") this.hideStudentModal();
      };
      document.addEventListener("keydown", this._studentEscHandler);
    }

    // 渲染加载中
    const body = document.getElementById("studentModalBody");
    if (body) body.innerHTML = `<div>加载中...</div>`;

    // 拉取学员信息与最近点评
    try {
      const [student, feedbacks] = await Promise.all([
        Utils.get(`/api/v1/students/${encodeURIComponent(studentId)}/`),
        Utils.get(`/api/v1/students/${encodeURIComponent(studentId)}/recent_feedbacks`, { limit: 10 }),
      ]);

      const nickname = this.escapeHtml(student?.nickname || "-");
      const remarkName = this.escapeHtml(student?.remark_name || "");
      const xetId = this.escapeHtml(student?.xiaoetong_id || "");
      const status = this.escapeHtml(student?.status || "");
      const tags = Array.isArray(student?.tag_names) ? student.tag_names.map((t) => `<span class="badge" style="margin-right:6px;">${this.escapeHtml(t)}</span>`).join("") : "";
      const impression = this.escapeHtml(student?.teacher_impression_current || "");
      const opNote = this.escapeHtml(student?.op_note || "");

      const fbListHtml = (Array.isArray(feedbacks) ? feedbacks : [])
        .map((f) => {
          const created = this.formatDateTime(f.created_at);
          const teacher = this.escapeHtml(f.teacher_name || "-");
          const content = this.escapeHtml(f.content_text || f.teacher_content || "");
          return `
            <div class="card" style="margin-bottom:8px;">
              <div class="card-header">
                <strong>${created}</strong>
                <span style="margin-left:8px;">教师：${teacher}</span>
              </div>
              <div class="card-body">${content || "-"}</div>
            </div>
          `;
        })
        .join("");

      const html = `
        <div>
          <div style="margin-bottom:10px;">
            <div><strong>昵称：</strong>${nickname}${remarkName ? `（备注：${remarkName}）` : ""}</div>
            <div><strong>状态：</strong>${status || "-"}</div>
            <div><strong>小鹅通ID：</strong>${xetId || "-"}</div>
            <div><strong>标签：</strong>${tags || "-"}</div>
          </div>
          <div style="margin-bottom:10px;">
            <div><strong>教师印象：</strong>${impression || "-"}</div>
            <div style="margin-top:4px;"><strong>运营备注：</strong>${opNote || "-"}</div>
          </div>
          <div>
            <h4 style="margin:8px 0;">最近点评</h4>
            ${fbListHtml || `<div class="empty">暂无点评记录</div>`}
          </div>
        </div>
      `;

      if (body) body.innerHTML = html;
    } catch (e) {
      console.error("加载学员详情失败:", e);
      if (body) body.innerHTML = `<div class="error">加载失败：${this.escapeHtml(e.message || "请稍后重试")}</div>`;
    }

    // 显示弹窗（已在 DOM 中，样式固定为显示）
    modal.style.display = "block";
  }

  hideStudentModal() {
    const modal = document.getElementById("studentInfoModal");
    if (modal) {
      modal.style.display = "none";
    }
    if (this._studentEscHandler) {
      document.removeEventListener("keydown", this._studentEscHandler);
      this._studentEscHandler = null;
    }
  }

  // ------- 小工具 -------
  formatDateTime(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
