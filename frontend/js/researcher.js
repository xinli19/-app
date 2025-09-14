/**
 * 教研管理系统主要功能
 */
class ResearcherApp {
  constructor() {
    this.currentUser = null;
    this.currentSection = "announcements";
    this.announcements = [];
    this.editingAnnouncement = null;

    // 点评列表状态：新增更多筛选项与排序
    this.evaluations = [];
    this.evalQuery = {
      q: "",
      start: "",
      end: "",
      page: 1,
      size: 20,
      teacher_id: "",
      student_id: "",
      course_id: "",
      ordering: "-created_at",
    };
    this.evalPage = { page: 1, size: 20, total: 0 };
    // 新增：教研提醒列表状态与分页
    this.reminders = [];
    this.reminderQuery = {
      page: 1,
      size: 20,
      q: "",
      only_active: true,
      ordering: "-created_at",
    };
    this.reminderPage = { page: 1, size: 20, total: 0 };
    // ... existing code ...
    this.init();

    // 新增：点评任务列表状态
    this.tasks = [];
    this.taskQuery = {
      page: 1,
      size: 10,
      ordering: "-created_at",
      q: "",
      status: "",
      assignee: "",
      batch_id: "", // 新增：批次筛选
    };
    // 批次草稿
    this.batchDraft = {
      batchId: "",
      assignee: "",
      note: "",
      students: [], // {id, nickname}
    };
    this.taskPage = { page: 1, size: 20, total: 0 };
    this.init();
  }

  init() {
    this.checkAuth();
    this.bindEvents();
    this.loadAnnouncements();
  }

  checkAuth() {
    const token = Utils.getToken();
    const user = Auth.getCurrentUser();

    if (!token || !user) {
      window.location.href = "index.html";
      return;
    }

    // 检查用户角色是否为教研
    if (user.role !== "researcher") {
      alert("您没有访问教研系统的权限");
      Auth.logout();
      window.location.href = "index.html";
      return;
    }

    this.currentUser = user;
    document.getElementById("username").textContent =
      user.username || "教研用户";
  }

  bindEvents() {
    // 导航切换
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.switchSection(section);
      });
    });
    const batchInput = document.getElementById("taskBatchInput");
    const batchApplyBtn = document.getElementById("taskBatchApplyBtn");
    if (batchApplyBtn) {
      batchApplyBtn.addEventListener("click", () => {
        this.taskQuery.batch_id = batchInput?.value?.trim() || "";
        this.taskQuery.page = 1;
        this.loadTasks();
      });
    }
    // 公告管理相关事件
    document
      .getElementById("newAnnouncementBtn")
      .addEventListener("click", () => {
        this.showAnnouncementModal();
      });

    // 教研提醒：创建按钮
    const newReminderBtn = document.getElementById("newReminderBtn");
    if (newReminderBtn) {
      newReminderBtn.addEventListener("click", () => {
        this.openReminderModal(null); // 无点评ID -> 通用创建
      });
    }
    // 打开批次创建
    const openBatchBtn = document.getElementById("openBatchCreatorBtn");
    if (openBatchBtn) {
      openBatchBtn.addEventListener("click", () => this.openBatchModal());
    }
    // 批次模态交互
    document
      .getElementById("batchCloseBtn")
      ?.addEventListener("click", () => this.closeBatchModal());
    document
      .getElementById("batchCancelBtn")
      ?.addEventListener("click", () => this.closeBatchModal());
    document
      .getElementById("batchStudentSearchBtn")
      ?.addEventListener("click", () => this.searchBatchStudents());
    document
      .getElementById("sendBatchBtn")
      ?.addEventListener("click", () => this.sendBatch());
    document
      .getElementById("importFromHistoryBtn")
      ?.addEventListener("click", () => this.toggleHistoryList());
    // 退出登录
    document.getElementById("logoutBtn").addEventListener("click", () => {
      Auth.logout();
      window.location.href = "index.html";
    });

    // 公告管理相关事件
    document
      .getElementById("newAnnouncementBtn")
      .addEventListener("click", () => {
        this.showAnnouncementModal();
      });

    // 模态框事件
    this.bindModalEvents();

    // === 点评管理：筛选/搜索/排序事件绑定（使用 researcher.html 的真实ID） ===
    const applyBtn = document.getElementById("applyFiltersBtn");
    const clearBtn = document.getElementById("clearFiltersBtn");
    const inputQ = document.getElementById("searchInput");
    const inputStart = document.getElementById("startDate");
    const inputEnd = document.getElementById("endDate");
    const selectTeacher = document.getElementById("teacherFilter");
    const selectCourse = document.getElementById("courseFilter");
    const selectSort = document.getElementById("sortBy");

    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        this.evalQuery.q = (inputQ?.value || "").trim();
        this.evalQuery.start = inputStart?.value || "";
        this.evalQuery.end = inputEnd?.value || "";
        this.evalQuery.teacher_id = (selectTeacher?.value || "").trim();
        this.evalQuery.course_id = (selectCourse?.value || "").trim();
        this.evalQuery.ordering = selectSort?.value || "-created_at";
        this.evalQuery.page = 1; // 改变筛选后回到第1页
        this.loadEvaluations();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (inputQ) inputQ.value = "";
        if (inputStart) inputStart.value = "";
        if (inputEnd) inputEnd.value = "";
        if (selectTeacher) selectTeacher.value = "";
        if (selectCourse) selectCourse.value = "";
        if (selectSort) selectSort.value = "-created_at";

        this.evalQuery = {
          q: "",
          start: "",
          end: "",
          page: 1,
          size: 20,
          teacher_id: "",
          student_id: "",
          course_id: "",
          ordering: "-created_at",
        };
        this.loadEvaluations();
      });
    }

    if (inputQ) {
      inputQ.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          applyBtn?.click();
        }
      });
    }

    if (selectSort) {
      selectSort.addEventListener("change", () => {
        this.evalQuery.ordering = selectSort.value || "-created_at";
        this.evalQuery.page = 1;
        this.loadEvaluations();
      });
    }

    // === 点评任务：筛选/搜索/排序事件绑定 ===
    const taskApplyBtn = document.getElementById("applyTaskFiltersBtn");
    const taskClearBtn = document.getElementById("clearTaskFiltersBtn");
    const taskInputQ = document.getElementById("taskSearchInput");
    const taskSelectStatus = document.getElementById("taskStatusFilter");
    const taskSelectAssignee = document.getElementById("taskAssigneeFilter");
    const taskSelectSort = document.getElementById("taskSortBy");
    const newTaskBtn = document.getElementById("newTaskBtn");
    const refreshTasksBtn = document.getElementById("refreshTasksBtn");

    if (taskApplyBtn) {
      taskApplyBtn.addEventListener("click", () => {
        this.taskQuery.q = (taskInputQ?.value || "").trim();
        this.taskQuery.status = taskSelectStatus?.value || "";
        this.taskQuery.assignee = (taskSelectAssignee?.value || "").trim();
        this.taskQuery.ordering = taskSelectSort?.value || "-created_at";
        this.taskQuery.page = 1;
        this.loadTasks();
      });
    }

    if (taskClearBtn) {
      taskClearBtn.addEventListener("click", () => {
        if (taskInputQ) taskInputQ.value = "";
        if (taskSelectStatus) taskSelectStatus.value = "";
        if (taskSelectAssignee) taskSelectAssignee.value = "";
        if (taskSelectSort) taskSelectSort.value = "-created_at";
        this.taskQuery = {
          q: "",
          status: "",
          assignee: "",
          page: 1,
          size: 20,
          ordering: "-created_at",
        };
        this.loadTasks();
      });
    }

    if (taskInputQ) {
      taskInputQ.addEventListener("keydown", (e) => {
        if (e.key === "Enter") taskApplyBtn?.click();
      });
    }

    if (taskSelectSort) {
      taskSelectSort.addEventListener("change", () => {
        this.taskQuery.ordering = taskSelectSort.value || "-created_at";
        this.taskQuery.page = 1;
        this.loadTasks();
      });
    }

    if (newTaskBtn) {
      newTaskBtn.addEventListener("click", () => {
        this.showTaskModal();
      });
    }

    if (refreshTasksBtn) {
      refreshTasksBtn.addEventListener("click", () => this.loadTasks());
    }

    // 任务模态框事件
    const taskModal = document.getElementById("taskModal");
    const taskModalCloseBtn = document.getElementById("taskModalCloseBtn");
    const taskModalCancelBtn = document.getElementById("taskModalCancelBtn");
    const taskForm = document.getElementById("taskForm");

    [taskModalCloseBtn, taskModalCancelBtn].forEach((btn) => {
      btn?.addEventListener("click", () => this.hideTaskModal());
    });
    taskModal?.addEventListener("click", (e) => {
      if (e.target === taskModal) this.hideTaskModal();
    });
    taskForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveTask();
    });

    // 学员搜索
    const taskStudentSearch = document.getElementById("taskStudentSearch");
    const debouncedSearch = Utils.debounce(async () => {
      const kw = (taskStudentSearch?.value || "").trim();
      await this.searchStudents(kw);
    }, 300);
    taskStudentSearch?.addEventListener("input", debouncedSearch);
    this.renderAnnouncements();
  }

  switchSection(sectionName) {
    // 更新导航状态
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${sectionName}"]`)
      .parentElement.classList.add("active");

    // 显示对应内容区域
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
    document.getElementById(`${sectionName}-section`).classList.add("active");

    this.currentSection = sectionName;

    // 根据不同模块加载数据
    switch (sectionName) {
      case "announcements":
        this.loadAnnouncements();
        break;
      case "reminders":
        this.loadReminders();
        break;
      case "evaluations":
        if (!this.evalFiltersLoaded) {
          this.initEvaluationFilters().finally(() => this.loadEvaluations());
        } else {
          this.loadEvaluations();
        }
        break;
      case "statistics":
        this.loadStatistics();
        break;
      case "tasks":
        if (!this.taskFiltersLoaded) {
          this.initTaskFilters().finally(() => this.loadTasks());
        } else {
          this.loadTasks();
        }
        break;
    }
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
  async loadTasks() {
    const list = document.getElementById("tasksList");
    const loading = document.getElementById("tasksLoading");
    if (loading) loading.style.display = "block";

    const params = {
      page: this.taskQuery.page,
      size: this.taskQuery.size,
      ordering: this.taskQuery.ordering,
    };
    if (this.taskQuery.q) params.search = this.taskQuery.q;
    if (this.taskQuery.status) params.status = this.taskQuery.status;
    if (this.taskQuery.assignee) params.assignee = this.taskQuery.assignee;
    if (this.taskQuery.batch_id) params.batch_id = this.taskQuery.batch_id; // 新增

    try {
      const resp = await Utils.get("/api/v1/eval-tasks/", params);
      // ... existing code ...
    } catch (e) {
      // ... existing code ...
    } finally {
      if (loading) loading.style.display = "none";
    }
  }
    // ... existing code ...
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
          const studentName = this.escapeHtml(t.student_nickname || t.student || "");
          const assigneeName = this.escapeHtml(t.assignee_name || t.assignee || "");
          const note = t.note ? this.escapeHtml(t.note) : "<em>无备注</em>";
  
          const editor = t.status !== "completed" ? `
            <div class="task-editor-wrap" style="margin-top:8px;">
              <textarea id="task-editor-${t.id}" class="task-editor" data-id="${t.id}" rows="4" placeholder="请输入教师点评内容（必填）"></textarea>
              <div class="editor-actions" style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="char-counter">已输入 <span id="task-char-${t.id}">0</span> 字</span>
                <button class="btn btn-success btn-submit-feedback" data-id="${t.id}">提交点评</button>
                <button class="btn btn-secondary btn-toggle-impression" data-id="${t.id}">填写教师印象</button>
                <button class="btn btn-info btn-toggle-reminder" data-id="${t.id}">推送提醒</button>
              </div>
            </div>
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
          ` : `
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
    // ... existing code ...
  async openBatchModal() {
    // 确保教师选项已加载
    if (!this.taskFiltersLoaded) {
      await this.initTaskFilters();
    }
    // 重置草稿
    this.batchDraft = { batchId: "", assignee: "", note: "", students: [] };
    document.getElementById("batchAssigneeSelect").value = "";
    document.getElementById("batchNote").value = "";
    document.getElementById("batchStudentSearch").value = "";
    document.getElementById("batchStudentResults").innerHTML = "";
    this.renderBatchSelectedList();
    document.getElementById("batchHistoryList").style.display = "none";

    // 将教师下拉选项与任务筛选中的教师下拉保持一致
    const assigneeSelect = document.getElementById("taskAssigneeSelect"); // 修正：原来是 taskAssignee（不存在）
    const batchAssigneeSelect = document.getElementById("batchAssigneeSelect");
    if (
      assigneeSelect &&
      batchAssigneeSelect &&
      assigneeSelect.options.length > 0
    ) {
      batchAssigneeSelect.innerHTML = assigneeSelect.innerHTML;
      batchAssigneeSelect.value = "";
    } else if (batchAssigneeSelect) {
      // 兜底：如未加载成功，重试初始化后复制
      try {
        await this.initTaskFilters();
        const retrySelect = document.getElementById("taskAssigneeSelect");
        if (retrySelect && retrySelect.options.length > 0) {
          batchAssigneeSelect.innerHTML = retrySelect.innerHTML;
          batchAssigneeSelect.value = "";
        }
      } catch (e) {
        console.warn("批次模态初始化教师下拉失败:", e);
      }
    }

    document.getElementById("batchModal")?.classList.add("show");
  }

  closeBatchModal() {
    document.getElementById("batchModal")?.classList.remove("show");
  }

  async searchBatchStudents() {
    const kw = document.getElementById("batchStudentSearch")?.value?.trim();
    const container = document.getElementById("batchStudentResults");
    if (!kw) {
      container.innerHTML =
        "<div class='empty-state'><em>请输入关键词</em></div>";
      return;
    }
    try {
      const list = await this.fetchStudents(kw);
      if (!list || list.length === 0) {
        container.innerHTML =
          "<div class='empty-state'><em>未找到匹配学员</em></div>";
        return;
      }
      container.innerHTML = list
        .map((s) => {
          const id = s.id || s.value || s.uuid || s.student || "";
          const name =
            s.nickname || s.name || s.label || `学员${id.slice(0, 6)}`;
          return `<div class="list-item"><span>${this.escapeHtml(name)}</span>
                        <button class="btn btn-small" data-action="add" data-id="${id}" data-name="${this.escapeHtml(
            name
          )}">添加</button>
                      </div>`;
        })
        .join("");

      container.querySelectorAll("button[data-action='add']").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          const name = e.currentTarget.getAttribute("data-name");
          this.addStudentToBatch({ id, nickname: name });
        });
      });
    } catch (e) {
      container.innerHTML = `<div class='empty-state'><em>搜索失败：${this.escapeHtml(
        e.message || "请稍后重试"
      )}</em></div>`;
    }
  }
  async fetchStudents(keyword) {
    if (!keyword) return [];
    const resp = await Utils.get("/api/students/", {
      search: keyword,
      size: 20,
      ordering: "nickname",
    });
    const items = resp.results || resp || [];
    return items;
  }
  addStudentToBatch(stu) {
    if (!stu?.id) return;
    if (this.batchDraft.students.some((s) => s.id === stu.id)) return;
    this.batchDraft.students.push({
      id: stu.id,
      nickname: stu.nickname || stu.name || "",
    });
    this.renderBatchSelectedList();
  }

  removeStudentFromBatch(id) {
    this.batchDraft.students = this.batchDraft.students.filter(
      (s) => s.id !== id
    );
    this.renderBatchSelectedList();
  }

  renderBatchSelectedList() {
    const box = document.getElementById("batchSelectedList");
    const count = document.getElementById("batchSelectedCount");
    const list = this.batchDraft.students || [];
    count.textContent = String(list.length);
    if (list.length === 0) {
      box.innerHTML = "<div class='empty-state'><em>尚未添加学员</em></div>";
      return;
    }
    box.innerHTML = list
      .map((s) => {
        const name = s.nickname || s.name || s.id;
        return `<div class="list-item">
                      <span>${this.escapeHtml(name)} (${this.escapeHtml(
          s.id
        )})</span>
                      <button class="btn btn-small btn-danger" data-id="${
                        s.id
                      }">移除</button>
                    </div>`;
      })
      .join("");
    box.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        this.removeStudentFromBatch(id);
      });
    });
  }

  async toggleHistoryList() {
    const panel = document.getElementById("batchHistoryList");
    if (panel.style.display === "none") {
      await this.loadRecentBatches();
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  }

  async loadRecentBatches() {
    const panel = document.getElementById("batchHistoryList");
    panel.innerHTML = "<div class='empty-state'><em>加载中...</em></div>";
    try {
      const resp = await Utils.get("/api/v1/eval-task-batches/", { limit: 20 });
      const items = resp.items || [];
      if (items.length === 0) {
        panel.innerHTML =
          "<div class='empty-state'><em>暂无历史批次</em></div>";
        return;
      }
      panel.innerHTML = items
        .map((b) => {
          const first = b.first_created_at
            ? this.formatDateTime(b.first_created_at)
            : "";
          const last = b.last_created_at
            ? this.formatDateTime(b.last_created_at)
            : "";
          return `<div class="list-item">
                        <div>
                          <div><strong>${this.escapeHtml(
                            b.batch_id
                          )}</strong></div>
                          <div class="secondary">共 ${
                            b.count
                          } 条，${first} ~ ${last}</div>
                        </div>
                        <button class="btn btn-small" data-batch="${this.escapeHtml(
                          b.batch_id
                        )}">导入</button>
                      </div>`;
        })
        .join("");
      panel.querySelectorAll("button[data-batch]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const bid = e.currentTarget.getAttribute("data-batch");
          await this.applyHistoryBatch(bid);
        });
      });
    } catch (e) {
      panel.innerHTML = `<div class='empty-state'><em>加载失败：${this.escapeHtml(
        e.message || "请稍后重试"
      )}</em></div>`;
    }
  }

  async applyHistoryBatch(batchId) {
    if (!batchId) return;
    try {
      // 直接用任务接口按批次拉取学员清单
      const resp = await Utils.get("/api/v1/eval-tasks/", {
        batch_id: batchId,
        page: 1,
        size: 500,
      });
      const results = resp.results || resp || [];
      const students = (results || [])
        .map((t) => ({
          id: t.student || t.student_id || t.studentId || "",
          nickname: t.student_nickname || "",
        }))
        .filter((s) => s.id);
      // 去重合并
      const exist = new Set(this.batchDraft.students.map((s) => s.id));
      students.forEach((s) => {
        if (!exist.has(s.id)) this.batchDraft.students.push(s);
      });
      this.renderBatchSelectedList();
      this.showSuccess("已导入历史批次学员");
    } catch (e) {
      this.showError(`导入失败：${e.message || "请稍后重试"}`);
    }
  }

  async sendBatch() {
    const assignee = document
      .getElementById("batchAssigneeSelect")
      ?.value?.trim();
    const note = document.getElementById("batchNote")?.value || "";
    if (!assignee) {
      alert("请选择负责人教师");
      return;
    }
    if (!this.batchDraft.students || this.batchDraft.students.length === 0) {
      alert("请先添加至少一名学员");
      return;
    }
    // 生成批次号（如未指定）
    const genUUID = () =>
      window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0,
              v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    const batchId = this.batchDraft.batchId || genUUID();

    try {
      const studentIds = this.batchDraft.students.map((s) => s.id);
      await Utils.request("/api/v1/eval-tasks/bulk/", {
        method: "POST",
        body: JSON.stringify({
          assignee,
          students: studentIds,
          note: note || null,
          batch_id: batchId,
        }),
      });
      this.closeBatchModal();
      this.showSuccess("批次创建成功");
      // 刷新并定位到该批次
      this.taskQuery.batch_id = batchId;
      this.taskQuery.page = 1;
      this.loadTasks();
    } catch (e) {
      this.showError(`批次创建失败：${e.message || "请稍后重试"}`);
    }
  }
  async loadAnnouncements() {
    try {
      const response = await Utils.request("/api/v1/announcements/", {
        method: "GET",
      });

      this.announcements = response.results || response;
      this.renderAnnouncements();
    } catch (error) {
      console.error("加载公告失败:", error);
      this.showError("加载公告失败，请稍后重试");
    }
  }

  renderAnnouncements() {
    const container = document.getElementById("announcementsList");

    if (this.announcements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>📢 暂无公告</h3>
          <p>点击上方"发布新公告"按钮创建第一条公告</p>
        </div>
      `;
      return;
    }

    const html = (this.announcements || [])
      .map((a) => `
        <div class="card announcement-card" data-id="${a.id}">
          <div class="card-header">
            <span class="badge">${this.getAnnouncementTypeText(a.type)}</span>
            <div class="announcement-actions" style="display:flex; gap:8px;">
              <button class="btn btn-small btn-secondary" onclick="app.editAnnouncement(${a.id})">编辑</button>
              <button class="btn btn-small btn-danger" onclick="app.deleteAnnouncement(${a.id})">删除</button>
            </div>
          </div>
          <div class="card-body">
            <div class="announcement-content">${a.content || ""}</div>
            <div class="announcement-meta muted" style="margin-top:8px; display:flex; gap:16px; flex-wrap:wrap;">
              <span>开始时间: ${this.formatDateTime(a.start_at)}</span>
              <span>${a.end_at ? ("结束时间: " + this.formatDateTime(a.end_at)) : "长期有效"}</span>
              <span class="timestamp">发布时间: ${this.formatDateTime(a.created_at)}</span>
            </div>
          </div>
        </div>
      `).join("");

    container.innerHTML = html;
  }

  getAnnouncementTypeText(type) {
    const types = {
      injury_notice: "学员伤病",
      teaching_reminder: "教学提醒",
    };
    return types[type] || type;
  }

  formatDateTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN");
  }
  getReminderCategoryText(value) {
    const map = {
      poor_effect: "教学效果差",
      attitude: "学员态度问题",
      injury: "有伤病",
      other: "其他",
    };
    return map[value] || value || "";
  }
  getUrgencyText(value) {
    const map = {
      urgent: "紧急需处理",
      normal: "不紧急需留意",
    };
    return map[value] || value || "";
  }

  // 其他模块的占位方法
  async loadReminders() {
    console.log("加载教研提醒数据...");
    try {
      const params = {
        page: this.reminderQuery.page || 1,
        size: this.reminderQuery.size || 20,
        ordering: this.reminderQuery.ordering || "-created_at",
        recipient_me: 1, // 只看“我”的收件箱
        include_only_active: 1, // 仅生效提醒
        to_research: 1, // 教研视图
      };
      if (this.reminderQuery.q) params.q = this.reminderQuery.q;
      if (this.reminderQuery.start) params.start = this.reminderQuery.start;
      if (this.reminderQuery.end) params.end = this.reminderQuery.end;
      if (this.reminderQuery.category)
        params.category = this.reminderQuery.category;
      if (this.reminderQuery.urgency)
        params.urgency = this.reminderQuery.urgency;
      if (this.reminderQuery.course_id)
        params.course_id = this.reminderQuery.course_id;

      const resp = await Utils.get("/api/v1/reminders/", params);

      // 兼容不同返回结构
      let items = [];
      let total = 0;
      let page = params.page;
      let size = params.size;

      if (Array.isArray(resp)) {
        items = resp;
        total = resp.length;
        page = 1;
        size = resp.length || params.size;
      } else if (resp && Array.isArray(resp.items)) {
        items = resp.items;
        total = typeof resp.total === "number" ? resp.total : items.length;
        page = resp.page || page;
        size = resp.size || size;
      } else if (resp && Array.isArray(resp.results)) {
        items = resp.results;
        total = typeof resp.count === "number" ? resp.count : items.length;
        // DRF 默认 page/size 不一定回传
      }

      this.reminders = items || [];
      this.reminderPage = { page, size, total };
      this.renderRemindersList();
    } catch (e) {
      console.error("加载教研提醒失败:", e);
      this.showError("加载教研提醒失败，请稍后重试");
      this.reminders = [];
      this.reminderPage = {
        page: 1,
        size: this.reminderQuery.size || 20,
        total: 0,
      };
      this.renderRemindersList();
    }
  }

  renderRemindersList() {
    const container = document.getElementById("remindersList");
    if (!container) return;

    const items = this.reminders || [];
    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无提醒</h3>
          <p>当前没有新的教研提醒。</p>
        </div>
      `;
      return;
    }

    const html = items
      .map((r) => {
        const categoryText = this.getReminderCategoryText(r.category);
        const urgencyText = this.getUrgencyText(r.urgency);
        const createdAt = this.formatDateTime(r.created_at);
        const startAt = this.formatDateTime(r.start_at);
        const endAt = this.formatDateTime(r.end_at);

        return `
          <div class="card reminder-card">
            <div class="card-header">
              <span class="badge urgency ${r.urgency || ""}">${this.escapeHtml(
          urgencyText
        )}</span>
              <span class="badge category ${
                r.category || ""
              }">${this.escapeHtml(categoryText)}</span>
              <span class="timestamp">创建：${this.escapeHtml(createdAt)}</span>
            </div>
            <div class="card-body">
              <div class="reminder-content">${this.escapeHtml(
                r.content || ""
              )}</div>
              <div class="reminder-meta">
                <span>生效：${this.escapeHtml(startAt || "-")}</span>
                <span>截至：${this.escapeHtml(endAt || "—")}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // 分页
    const page = this.reminderPage.page || 1;
    const size = this.reminderPage.size || 20;
    const total = this.reminderPage.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / size));

    container.innerHTML = `
      <div class="reminders-wrapper">
        ${html}
      </div>
      <div class="pagination">
        <button class="btn btn-secondary" id="remPrevPage" ${
          page <= 1 ? "disabled" : ""
        }>上一页</button>
        <span class="page-info">第 ${page} 页 / 共 ${totalPages} 页（共 ${total} 条）</span>
        <button class="btn btn-secondary" id="remNextPage" ${
          page >= totalPages ? "disabled" : ""
        }>下一页</button>
      </div>
    `;

    const prevBtn = document.getElementById("remPrevPage");
    const nextBtn = document.getElementById("remNextPage");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this.reminderQuery.page > 1) {
          this.reminderQuery.page -= 1;
          this.loadReminders();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (this.reminderPage.page < totalPages) {
          this.reminderQuery.page += 1;
          this.loadReminders();
        }
      });
    }
  }
  // ... existing code ...
  async loadEvaluations() {
    console.log("加载点评管理数据...");
    try {
      // 组装查询参数，支持后端的 page/size、q、start、end
      const params = {
        page: this.evalQuery.page || 1,
        size: this.evalQuery.size || 20,
      };
      if (this.evalQuery.q) params.q = this.evalQuery.q;
      if (this.evalQuery.start) params.start = this.evalQuery.start;
      if (this.evalQuery.end) params.end = this.evalQuery.end;
      if (this.evalQuery.teacher_id)
        params.teacher_id = this.evalQuery.teacher_id;
      if (this.evalQuery.student_id)
        params.student_id = this.evalQuery.student_id;
      if (this.evalQuery.course_id) params.course_id = this.evalQuery.course_id;
      if (this.evalQuery.ordering) params.ordering = this.evalQuery.ordering;

      const resp = await Utils.get("/api/v1/feedbacks/", params);

      // 兼容不同返回结构
      let items = [];
      let total = 0;
      let page = params.page;
      let size = params.size;

      if (Array.isArray(resp)) {
        items = resp;
        total = resp.length;
        page = 1;
        size = resp.length || params.size;
      } else if (resp && Array.isArray(resp.items)) {
        items = resp.items;
        total = typeof resp.total === "number" ? resp.total : items.length;
        page = resp.page || page;
        size = resp.size || size;
      } else if (resp && Array.isArray(resp.results)) {
        items = resp.results;
        total = typeof resp.count === "number" ? resp.count : items.length;
        // DRF 默认 page/size 不一定回传，这里用当前查询
      }

      this.evaluations = items || [];
      this.evalPage = { page, size, total };
      this.renderEvaluationsList();
      this.renderEvaluationsPagination();
    } catch (error) {
      console.error("加载点评记录失败:", error);
      this.showError("加载点评记录失败，请稍后重试");
      // 回退为空列表
      this.evaluations = [];
      this.evalPage = { page: 1, size: this.evalQuery.size || 20, total: 0 };
      this.renderEvaluationsList();
      this.renderEvaluationsPagination();
    }
  }

  loadStatistics() {
    console.log("加载工作量统计数据...");
    // TODO: 实现工作量统计数据加载
  }

  // 筛选下拉初始化（移除曲目联动）
  async initEvaluationFilters() {
    try {
      await Promise.all([this.loadTeacherOptions(), this.loadCourseOptions()]);
      this.evalFiltersLoaded = true;
    } catch (e) {
      console.error("初始化点评筛选下拉失败:", e);
      this.showError("初始化筛选选项失败，请刷新页面重试");
    }
  }

  async loadTeacherOptions() {
    const select = document.getElementById("teacherFilter");
    if (!select) return;
    try {
      const resp = await Utils.get("/api/persons/roles/", {
        role: "teacher",
        size: 1000,
      });
      const items = resp.results || resp || [];
      const options = ['<option value="">全部教师</option>'].concat(
        items.map(
          (r) =>
            `<option value="${r.person}">${r.person_name || r.person}</option>`
        )
      );
      select.innerHTML = options.join("");
    } catch (e) {
      console.error("加载教师列表失败:", e);
      // 保留“全部教师”
      select.innerHTML = '<option value="">全部教师</option>';
    }
  }

  async loadCourseOptions() {
    const select = document.getElementById("courseFilter");
    if (!select) return;
    try {
      const resp = await Utils.get("/api/courses/", {
        status: "enabled",
        size: 1000,
        ordering: "name",
      });
      const items = resp.results || resp || [];
      const options = ['<option value="">全部课程</option>'].concat(
        items.map((c) => `<option value="${c.id}">${c.name}</option>`)
      );
      select.innerHTML = options.join("");
    } catch (e) {
      console.error("加载课程列表失败:", e);
      select.innerHTML = '<option value="">全部课程</option>';
    }
  }

  bindModalEvents() {
    // 公告模态框事件绑定
    const modal = document.getElementById("announcementModal");
    const closeBtn = document.getElementById("modalCloseBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const form = document.getElementById("announcementForm");

    [closeBtn, cancelBtn].forEach((btn) => {
      btn.addEventListener("click", () => {
        this.hideAnnouncementModal();
      });
    });

    // 点击模态框外部关闭
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideAnnouncementModal();
      }
    });

    // 表单提交
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveAnnouncement();
    });
  }

  showAnnouncementModal(announcement = null) {
    const modal = document.getElementById("announcementModal");
    const title = document.getElementById("modalTitle");
    const submitBtn = document.getElementById("modalSubmitBtn");
    const form = document.getElementById("announcementForm");

    this.editingAnnouncement = announcement;

    if (announcement) {
      title.textContent = "编辑公告";
      submitBtn.textContent = "保存修改";
      this.fillAnnouncementForm(announcement);
    } else {
      title.textContent = "发布新公告";
      submitBtn.textContent = "发布公告";
      form.reset();
      // 设置默认开始时间为当前时间
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById("startAt").value = now.toISOString().slice(0, 16);
    }

    modal.classList.add("show");
  }

  hideAnnouncementModal() {
    const modal = document.getElementById("announcementModal");
    modal.classList.remove("show");
    this.editingAnnouncement = null;
  }

  fillAnnouncementForm(announcement) {
    document.getElementById("announcementType").value = announcement.type;
    document.getElementById("announcementContent").value = announcement.content;

    if (announcement.start_at) {
      const startDate = new Date(announcement.start_at);
      startDate.setMinutes(
        startDate.getMinutes() - startDate.getTimezoneOffset()
      );
      document.getElementById("startAt").value = startDate
        .toISOString()
        .slice(0, 16);
    }

    if (announcement.end_at) {
      const endDate = new Date(announcement.end_at);
      endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
      document.getElementById("endAt").value = endDate
        .toISOString()
        .slice(0, 16);
    }
  }

  async saveAnnouncement() {
    const form = document.getElementById("announcementForm");
    const formData = new FormData(form);

    const data = {
      type: formData.get("type"),
      content: formData.get("content"),
      start_at: formData.get("start_at") || new Date().toISOString(),
      end_at: formData.get("end_at") || null,
      publisher: this.currentUser.person_id,
    };

    try {
      let response;
      if (this.editingAnnouncement) {
        response = await Utils.request(
          `/api/v1/announcements/${this.editingAnnouncement.id}/`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );
      } else {
        response = await Utils.request("/api/v1/announcements/", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }

      this.hideAnnouncementModal();
      this.loadAnnouncements();
      this.showSuccess(
        this.editingAnnouncement ? "公告更新成功" : "公告发布成功"
      );
    } catch (error) {
      console.error("保存公告失败:", error);
      this.showError("保存公告失败，请稍后重试");
    }
  }

  editAnnouncement(id) {
    const announcement = this.announcements.find((a) => a.id === id);
    if (announcement) {
      this.showAnnouncementModal(announcement);
    }
  }

  async deleteAnnouncement(id) {
    if (!confirm("确定要删除这条公告吗？此操作不可撤销。")) {
      return;
    }

    try {
      await Utils.request(`/api/v1/announcements/${id}/`, {
        method: "DELETE",
      });

      this.loadAnnouncements();
      this.showSuccess("公告删除成功");
    } catch (error) {
      console.error("删除公告失败:", error);
      this.showError("删除公告失败，请稍后重试");
    }
  }

  // 工具方法
  showSuccess(message) {
    // 简单的成功提示，可以后续优化为更好的UI组件
    alert(message);
  }

  showError(message) {
    // 简单的错误提示，可以后续优化为更好的UI组件
    alert(message);
  }

  renderEvaluationsList() {
    const container = document.getElementById("evaluationsList");
    if (!container) return;

    if (!this.evaluations || this.evaluations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>📄 暂无数据</h3>
          <p>调整筛选条件后再试试</p>
        </div>
      `;
      return;
    }

    const html = this.evaluations.map((item) => {
      const createdAt = this.formatDateTime(item.created_at);
      const studentName = item.student_nickname || item.student?.nickname || item.student || "-";
      const teacherName = item.teacher_name || item.teacher?.name || item.teacher || "-";
      const teacherContent = (item.content_text || item.teacher_content || "").toString();
      const researcherFeedback = (item.researcher_feedback || "").toString();

      return `
        <div class="card evaluation-card" data-id="${item.id}">
          <div class="card-header" style="justify-content:space-between;">
            <div>
              <strong>学员：</strong>${studentName}
              <span class="muted" style="margin-left:12px;">教师：${teacherName}</span>
            </div>
            <div class="muted">创建时间：${createdAt || "-"}</div>
          </div>
          <div class="card-body">
            <div class="evaluation-row" style="display:flex; gap:16px; flex-wrap:wrap;">
              <div class="evaluation-col">
                <div><strong>教师点评：</strong><span title="${teacherContent.replace(/"/g, "&quot;")}">${teacherContent || "-"}</span></div>
              </div>
              <div class="evaluation-col">
                <div><strong>教研反馈：</strong><span title="${researcherFeedback.replace(/"/g, "&quot;")}">${researcherFeedback || "-"}</span></div>
              </div>
            </div>
            <div class="evaluation-actions" style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn btn-small btn-secondary" data-action="feedback" data-id="${item.id}">填写/编辑教研反馈</button>
              <button class="btn btn-small btn-primary" data-action="reminder" data-id="${item.id}">创建提醒</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html;

    // 事件绑定：打开反馈/提醒模态框
    container.querySelectorAll('[data-action="feedback"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openFeedbackModal(id);
      });
    });
    container.querySelectorAll('[data-action="reminder"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openReminderModal(id);
      });
    });
  }
  // ... existing code ...
  bindModalEvents() {
    // 公告模态框事件绑定
    const modal = document.getElementById("announcementModal");
    const closeBtn = document.getElementById("modalCloseBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const form = document.getElementById("announcementForm");

    [closeBtn, cancelBtn].forEach((btn) => {
      btn.addEventListener("click", () => {
        this.hideAnnouncementModal();
      });
    });

    // 点击模态框外部关闭
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideAnnouncementModal();
      }
    });

    // 表单提交
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveAnnouncement();
    });

    // === 新增：教研反馈模态框 ===
    const feedbackModal = document.getElementById("feedbackModal");
    const feedbackCloseBtn = document.getElementById("feedbackModalCloseBtn");
    const feedbackCancelBtn = document.getElementById("feedbackModalCancelBtn");
    const feedbackForm = document.getElementById("feedbackForm");
    [feedbackCloseBtn, feedbackCancelBtn].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => this.hideFeedbackModal());
      }
    });
    if (feedbackModal) {
      feedbackModal.addEventListener("click", (e) => {
        if (e.target === feedbackModal) this.hideFeedbackModal();
      });
    }
    if (feedbackForm) {
      feedbackForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveFeedback();
      });
    }

    // === 新增：创建提醒模态框 ===
    const reminderModal = document.getElementById("createReminderModal");
    const reminderCloseBtn = document.getElementById("reminderModalCloseBtn");
    const reminderCancelBtn = document.getElementById("reminderModalCancelBtn");
    const reminderForm = document.getElementById("reminderForm");
    [reminderCloseBtn, reminderCancelBtn].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => this.hideReminderModal());
      }
    });
    if (reminderModal) {
      reminderModal.addEventListener("click", (e) => {
        if (e.target === reminderModal) this.hideReminderModal();
      });
    }
    if (reminderForm) {
      reminderForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveReminder();
      });
    }
  }
  // ... existing code ...
  openFeedbackModal(recordId) {
    // 调试：输出传入的 recordId 和当前列表 ids
    console.debug("openFeedbackModal called with:", {
      recordId,
      type: typeof recordId,
    });
    const ids = (this.evaluations || []).map((x) => String(x.id));
    console.debug("openFeedbackModal evaluations ids:", ids);

    // 统一用字符串比较，避免类型不一致导致查找失败
    const item = this.evaluations.find(
      (x) => String(x.id) === String(recordId)
    );
    if (!item) {
      console.warn(
        "openFeedbackModal: item not found. Available ids with types:",
        (this.evaluations || []).map((x) => ({ id: x.id, type: typeof x.id }))
      );
      this.showError("未找到该点评记录");
      return;
    }
    // 预填信息
    const studentName =
      item.student_nickname || item.student?.nickname || item.student || "-";
    const teacherName =
      item.teacher_name || item.teacher?.name || item.teacher || "-";
    const createdAt = this.formatDateTime(item.created_at) || "-";
    const teacherContent = (
      item.content_text ||
      item.teacher_content ||
      ""
    ).toString();
    const researcherFeedback = (item.researcher_feedback || "").toString();

    document.getElementById("feedbackRecordId").value = String(item.id);
    document.getElementById("feedbackStudentName").textContent = studentName;
    document.getElementById("feedbackTeacherName").textContent = teacherName;
    document.getElementById("feedbackCreatedAt").textContent = createdAt;
    document.getElementById("feedbackTeacherContent").textContent =
      teacherContent;
    document.getElementById("researcherFeedback").value = researcherFeedback;

    document.getElementById("feedbackModal").classList.add("show");
  }
  // ... existing code ...
  hideFeedbackModal() {
    const m = document.getElementById("feedbackModal");
    if (m) m.classList.remove("show");
  }
  // ... existing code ...
  async saveFeedback() {
    const id = (document.getElementById("feedbackRecordId").value || "").trim();
    const content = (
      document.getElementById("researcherFeedback").value || ""
    ).trim();
    if (!id) {
      this.showError("未找到点评记录ID");
      return;
    }
    if (!content) {
      this.showError("请填写教研反馈内容");
      return;
    }
    // 调试：打印即将调用的 PATCH URL 使用的 id（应为 UUID 字符串）
    console.debug("saveFeedback: using id for PATCH:", id, "type:", typeof id);

    try {
      await Utils.request(`/api/v1/feedbacks/${encodeURIComponent(id)}/`, {
        method: "PATCH",
        body: JSON.stringify({ researcher_feedback: content }),
      });
      this.hideFeedbackModal();
      this.showSuccess("教研反馈已保存");
      // 保存后刷新当前列表
      await this.loadEvaluations();
    } catch (e) {
      console.error(e);
      this.showError(e.message || "保存失败，请稍后重试");
    }
  }
  // ... existing code ...
  openReminderModal(recordId) {
    // 调试：输出传入的 recordId 和当前列表 ids
    console.debug("openReminderModal called with:", {
      recordId,
      type: typeof recordId,
    });
    const ids = (this.evaluations || []).map((x) => String(x.id));
    console.debug("openReminderModal evaluations ids:", ids);

    const item = this.evaluations.find(
      (x) => String(x.id) === String(recordId)
    );

    const feedbackInput = document.getElementById("reminderFeedbackIds");
    const recipientsBox = document.getElementById("reminderRecipients");
    const cat = document.getElementById("reminderCategory");
    const urg = document.getElementById("reminderUrgency");

    if (cat) cat.value = "other";
    if (urg) urg.value = "normal";
    document.getElementById("reminderContent").value = "";

    if (item) {
      // 场景1：从点评记录创建（沿用原逻辑）
      if (feedbackInput) feedbackInput.value = String(item.id);
      const teacherName =
        item.teacher_name || item.teacher?.name || item.teacher || "-";
      if (recipientsBox) {
        recipientsBox.innerHTML = `<span class="tag">接收人：教师 ${this.escapeHtml(
          teacherName
        )}</span>`;
        recipientsBox.dataset.mode = "fixed"; // 固定接收人
        recipientsBox.dataset.receiverId = String(item.teacher || "");
      }
    } else {
      // 场景2：通用创建（从提醒模块入口）
      if (feedbackInput) feedbackInput.value = "";
      if (recipientsBox) {
        recipientsBox.innerHTML = `
          <div class="field">
            <label>选择接收人（教师）</label>
            <select id="reminderReceiverSelect">
              <option value="">请选择接收教师</option>
            </select>
          </div>
        `;
        recipientsBox.dataset.mode = "select";
        recipientsBox.dataset.receiverId = "";
      }
      // 加载教师列表
      this.loadReminderReceiverOptions().catch((e) =>
        console.error("加载接收人失败：", e)
      );
    }

    document.getElementById("createReminderModal").classList.add("show");
  }
  async loadReminderReceiverOptions() {
    const select = document.getElementById("reminderReceiverSelect");
    if (!select) return;
    try {
      const resp = await Utils.get("/api/persons/roles/", {
        role: "teacher",
        size: 1000,
      });
      const items = resp.results || resp || [];
      const options = ['<option value="">请选择接收教师</option>'].concat(
        items.map(
          (r) =>
            `<option value="${r.person}">${this.escapeHtml(
              r.person_name || r.person
            )}</option>`
        )
      );
      select.innerHTML = options.join("");
      select.addEventListener("change", () => {
        const box = document.getElementById("reminderRecipients");
        if (box) box.dataset.receiverId = select.value || "";
      });
    } catch (e) {
      console.error("加载接收教师失败:", e);
      select.innerHTML = '<option value="">加载教师失败，请稍后重试</option>';
    }
  }
  // ... existing code ...
  // ... existing code ...
  hideReminderModal() {
    const m = document.getElementById("createReminderModal");
    if (m) m.classList.remove("show");
  }
  // ... existing code ...
  async saveReminder() {
    // 用字符串读取，避免 parseInt 造成 NaN 或类型不匹配
    const feedbackId = document.getElementById("reminderFeedbackIds").value;
    // 调试：隐藏域中的反馈ID 和当前列表 ids
    console.debug("saveReminder feedbackId from hidden:", {
      feedbackId,
      type: typeof feedbackId,
    });
    console.debug(
      "saveReminder evaluations ids:",
      (this.evaluations || []).map((x) => String(x.id))
    );

    const category = document.getElementById("reminderCategory").value || "";
    const urgency = document.getElementById("reminderUrgency").value || "";
    const content = (
      document.getElementById("reminderContent").value || ""
    ).trim();

    if (!category) return this.showError("请选择提醒类别");
    if (!urgency) return this.showError("请选择紧急程度");
    if (!content) return this.showError("请填写提醒内容");

    // 发送人与审计后端会自动填充，这里不强制传 sender
    let payload = { category, urgency, content };

    // 如果来自点评记录
    const item =
      (feedbackId &&
        this.evaluations.find((x) => String(x.id) === String(feedbackId))) ||
      null;
    if (item) {
      payload = {
        ...payload,
        receiver: item.teacher, // 点评教师为接收人
        student: item.student || null,
        feedback: item.id,
      };
    } else {
      // 通用创建：必须选择接收人
      const box = document.getElementById("reminderRecipients");
      const receiverId =
        (box && (box.dataset.receiverId || "").trim()) ||
        (document.getElementById("reminderReceiverSelect")?.value || "").trim();
      if (!receiverId) {
        return this.showError("请选择提醒的接收教师");
      }
      payload = {
        ...payload,
        receiver: receiverId,
        student: null,
        feedback: null,
      };
    }

    try {
      await Utils.request("/api/v1/reminders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      this.hideReminderModal();
      this.showSuccess("提醒已创建");
      // 创建后刷新列表
      await this.loadReminders();
    } catch (e) {
      console.error(e);
      this.showError(e.message || "创建提醒失败，请稍后重试");
    }
  }
  // ... existing code ...

  renderEvaluationsPagination() {
    const wrapper = document.getElementById("evaluationsPagination");
    if (!wrapper) return;

    const page = this.evalPage.page || 1;
    const size = this.evalPage.size || 20;
    const total = this.evalPage.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / size));

    wrapper.innerHTML = `
                <button class="btn btn-secondary" id="evalPrevPage" ${
                  page <= 1 ? "disabled" : ""
                }>上一页</button>
                <span class="page-info" id="evalPageInfo">第 ${page} 页 / 共 ${totalPages} 页（共 ${total} 条）</span>
                <button class="btn btn-secondary" id="evalNextPage" ${
                  page >= totalPages ? "disabled" : ""
                }>下一页</button>
            `;

    const prevBtn = document.getElementById("evalPrevPage");
    const nextBtn = document.getElementById("evalNextPage");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this.evalPage.page > 1) {
          this.evalQuery.page = this.evalPage.page - 1;
          this.loadEvaluations();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const totalPagesLocal = Math.max(
          1,
          Math.ceil(this.evalPage.total / this.evalPage.size)
        );
        if (this.evalPage.page < totalPagesLocal) {
          this.evalQuery.page = this.evalPage.page + 1;
          this.loadEvaluations();
        }
      });
    }
  }

  async initTaskFilters() {
    try {
      // 负责人教师下拉
      const assigneeSelect = document.getElementById("taskAssigneeFilter");
      const assigneeSelect2 = document.getElementById("taskAssigneeSelect");
      const resp = await Utils.get("/api/persons/roles/", {
        role: "teacher",
        size: 1000,
      });
      const items = resp.results || resp || [];
      const options = ['<option value="">全部教师</option>'].concat(
        items.map(
          (r) =>
            `<option value="${r.person}">${r.person_name || r.person}</option>`
        )
      );
      if (assigneeSelect) assigneeSelect.innerHTML = options.join("");

      const createOptions = ['<option value="">请选择教师</option>'].concat(
        items.map(
          (r) =>
            `<option value="${r.person}">${r.person_name || r.person}</option>`
        )
      );
      if (assigneeSelect2) assigneeSelect2.innerHTML = createOptions.join("");

      this.taskFiltersLoaded = true;
    } catch (e) {
      console.error("初始化任务筛选下拉失败:", e);
      // 降级：至少保证占位
      const assigneeSelect = document.getElementById("taskAssigneeFilter");
      const assigneeSelect2 = document.getElementById("taskAssigneeSelect");
      if (assigneeSelect)
        assigneeSelect.innerHTML = '<option value="">全部教师</option>';
      if (assigneeSelect2)
        assigneeSelect2.innerHTML = '<option value="">请选择教师</option>';
    }
  }

  async loadTasks() {
    const list = document.getElementById("tasksList");
    const loading = document.getElementById("tasksLoading");
    if (loading) loading.style.display = "block";

    // 组装查询
    const params = {
      page: this.taskQuery.page,
      size: this.taskQuery.size,
      ordering: this.taskQuery.ordering,
    };
    if (this.taskQuery.q) params.search = this.taskQuery.q;
    if (this.taskQuery.status) params.status = this.taskQuery.status;
    if (this.taskQuery.assignee) params.assignee = this.taskQuery.assignee;

    try {
      const resp = await Utils.get("/api/v1/eval-tasks/", params);
      const results = resp.results || resp || [];
      const total = resp.count ?? results.length;

      this.tasks = results;
      this.taskPage = {
        page: this.taskQuery.page,
        size: this.taskQuery.size,
        total,
      };
      this.renderTasksList();
      this.renderTasksPagination();
    } catch (e) {
      console.error("加载点评任务失败:", e);
      list.innerHTML = `
          <div class="empty-state">
            <h3>加载失败</h3>
            <p>${e.message || "请稍后重试"}</p>
          </div>`;
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  renderTasksList() {
    const container = document.getElementById("tasksList");
    if (!this.tasks || this.tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无任务</h3>
          <p>点击右上角“新建任务”进行分配</p>
        </div>`;
      return;
    }

    const html = this.tasks.map((t) => {
      const statusText = t.status === "completed" ? "已完成" : "未完成";
      const createdAt = t.created_at ? this.formatDateTime(t.created_at) : "";
      const updatedAt = t.updated_at ? this.formatDateTime(t.updated_at) : "";

      return `
        <div class="card task-card" data-id="${t.id}">
          <div class="card-header" style="justify-content:space-between;">
            <div>
              <strong>学员：</strong>${t.student_nickname || t.student}
              <span class="muted" style="margin-left:12px;">负责人：${t.assignee_name || t.assignee}</span>
              <span class="badge" style="margin-left:12px;">${statusText}</span>
            </div>
            <div class="muted">
              <span>来源：${t.source === "teacher" ? "教师" : "教研"}</span>
              <span style="margin-left:12px;">创建：${createdAt}</span>
              <span style="margin-left:12px;">更新：${updatedAt}</span>
            </div>
          </div>
          <div class="card-body">
            ${t.note ? this.escapeHtml(t.note) : "<em class='muted'>无备注</em>"}
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html;
  }

  renderTasksPagination() {
    const p = this.taskPage;
    const pag = document.getElementById("tasksPagination");
    if (!p || !pag) return;

    const totalPages = Math.max(1, Math.ceil(p.total / p.size));
    const cur = Math.min(Math.max(1, p.page), totalPages);

    const btn = (label, page, disabled = false, active = false) =>
      `<button class="page-btn ${active ? "active" : ""}" ${
        disabled ? "disabled" : ""
      } data-page="${page}">${label}</button>`;

    const parts = [];
    parts.push(btn("«", 1, cur === 1));
    parts.push(btn("‹", Math.max(1, cur - 1), cur === 1));
    for (
      let i = Math.max(1, cur - 2);
      i <= Math.min(totalPages, cur + 2);
      i++
    ) {
      parts.push(btn(String(i), i, false, i === cur));
    }
    parts.push(btn("›", Math.min(totalPages, cur + 1), cur === totalPages));
    parts.push(btn("»", totalPages, cur === totalPages));

    pag.innerHTML = parts.join("");
    pag.querySelectorAll(".page-btn").forEach((el) => {
      el.addEventListener("click", () => {
        const next = parseInt(el.getAttribute("data-page"), 10);
        if (!isNaN(next) && next !== this.taskQuery.page) {
          this.taskQuery.page = next;
          this.loadTasks();
        }
      });
    });
  }

  async searchStudents(keyword) {
    const select = document.getElementById("taskStudentSelect");
    if (!select) return;
    if (!keyword) {
      select.innerHTML = '<option value="">请选择学员</option>';
      return;
    }
    try {
      const resp = await Utils.get("/api/students/", {
        search: keyword,
        size: 20,
        ordering: "nickname",
      });
      const items = resp.results || resp || [];
      const options = ['<option value="">请选择学员</option>'].concat(
        items.map(
          (s) => `<option value="${s.id}">${s.nickname} (#${s.id})</option>`
        )
      );
      select.innerHTML = options.join("");
    } catch (e) {
      console.error("搜索学员失败:", e);
      select.innerHTML = '<option value="">搜索失败，请重试</option>';
    }
  }

  async fetchStudents(keyword) {
    if (!keyword) return [];
    try {
      const resp = await Utils.get("/api/students/", {
        search: keyword,
        size: 20,
        ordering: "nickname",
      });
      const items = resp.results || resp || [];
      return items.map((s) => ({
        id: s.id,
        nickname: s.nickname || s.name || "",
        name: s.nickname || s.name || "",
        value: s.id,
        label: s.nickname ? `${s.nickname} (#${s.id})` : `#${s.id}`,
      }));
    } catch (e) {
      console.error("获取学员列表失败:", e);
      return [];
    }
  }

  showTaskModal() {
    const modal = document.getElementById("taskModal");
    const form = document.getElementById("taskForm");
    const studentSearch = document.getElementById("taskStudentSearch");
    const studentSelect = document.getElementById("taskStudentSelect");
    const assigneeSelect = document.getElementById("taskAssigneeSelect");
    const note = document.getElementById("taskNote");

    form?.reset();
    if (studentSelect)
      studentSelect.innerHTML = '<option value="">请选择学员</option>';
    if (studentSearch) studentSearch.value = "";
    if (assigneeSelect) {
      // 确保已加载教师选项
      if (!this.taskFiltersLoaded) {
        this.initTaskFilters();
      }
    }
    if (note) note.value = "";

    modal?.classList.add("show");
  }

  hideTaskModal() {
    const modal = document.getElementById("taskModal");
    modal?.classList.remove("show");
  }

  async saveTask() {
    const studentId = document
      .getElementById("taskStudentSelect")
      ?.value?.trim();
    const assigneeId = document
      .getElementById("taskAssigneeSelect")
      ?.value?.trim();
    const note = document.getElementById("taskNote")?.value || "";

    if (!studentId) {
      alert("请选择学员");
      return;
    }
    if (!assigneeId) {
      alert("请选择负责人教师");
      return;
    }

    try {
      await Utils.request("/api/v1/eval-tasks/", {
        method: "POST",
        body: JSON.stringify({
          student: studentId,
          assignee: assigneeId,
          source: "researcher",
          note: note || null,
        }),
      });
      this.hideTaskModal();
      this.showSuccess("任务创建成功");
      // 刷新列表，回到第一页以便看到最新
      this.taskQuery.page = 1;
      this.loadTasks();
    } catch (e) {
      console.error("创建任务失败:", e);
      this.showError(e.message || "创建任务失败，请稍后重试");
    }
  }

  // 小工具：简单转义（用于备注显示）
  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

// 页面加载后实例化应用，并暴露到 window 供 HTML 内联事件调用
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.app = new ResearcherApp();
  } catch (e) {
    console.error("初始化教研页面失败：", e);
  }
});
