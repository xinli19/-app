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
  // 公告
  renderTasksList() {
    const container = document.getElementById("tasksList");
    if (!this.tasks || this.tasks.length === 0) {
      container.innerHTML = `
          <div class="empty-state">
            <h3>暂无任务</h3>
            <p>点击右上角“新建任务”或“创建任务批次”进行分配</p>
          </div>`;
      return;
    }

    const html = this.tasks
      .map((t) => {
        const statusBadge =
          t.status === "completed"
            ? '<span class="badge badge-success">已完成</span>'
            : '<span class="badge badge-warning">未完成</span>';
        const createdAt = t.created_at ? this.formatDateTime(t.created_at) : "";
        const updatedAt = t.updated_at ? this.formatDateTime(t.updated_at) : "";
        const batchTag = t.batch_id
          ? `<span class="tag">批次: ${this.escapeHtml(t.batch_id)}</span>`
          : "";

        return `
            <div class="evaluation-item" data-id="${t.id}">
              <div class="evaluation-meta">
                <div>
                  <strong>学员：</strong>${t.student_nickname || t.student}
                  &nbsp;&nbsp;<strong>负责人：</strong>${
                    t.assignee_name || t.assignee
                  }
                  &nbsp;&nbsp;<strong>状态：</strong>${statusBadge}
                  &nbsp;&nbsp;${batchTag}
                </div>
                <div class="secondary">
                  <span>来源：${t.source === "teacher" ? "教师" : "教研"}</span>
                  &nbsp;&nbsp;<span>创建：${createdAt}</span>
                  &nbsp;&nbsp;<span>更新：${updatedAt}</span>
                </div>
              </div>
              <div class="evaluation-content">
                ${t.note ? this.escapeHtml(t.note) : "<em>无备注</em>"}
              </div>
            </div>
          `;
      })
      .join("");

    container.innerHTML = html;
  }
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

    const html = this.announcements
      .map(
        (announcement) => `
                <div class="announcement-item" data-id="${announcement.id}">
                    <div class="announcement-header">
                        <span class="announcement-type ${announcement.type}">
                            ${this.getAnnouncementTypeText(announcement.type)}
                        </span>
                        <div class="announcement-actions">
                            <button class="btn btn-small btn-secondary" onclick="app.editAnnouncement(${
                              announcement.id
                            })">
                                编辑
                            </button>
                            <button class="btn btn-small btn-danger" onclick="app.deleteAnnouncement(${
                              announcement.id
                            })">
                                删除
                            </button>
                        </div>
                    </div>
                    <div class="announcement-content">
                        ${announcement.content}
                    </div>
                    <div class="announcement-meta">
                        <div class="announcement-time">
                            <span>开始时间: ${this.formatDateTime(
                              announcement.start_at
                            )}</span>
                            ${
                              announcement.end_at
                                ? `<span>结束时间: ${this.formatDateTime(
                                    announcement.end_at
                                  )}</span>`
                                : "<span>长期有效</span>"
                            }
                        </div>
                        <span>发布时间: ${this.formatDateTime(
                          announcement.created_at
                        )}</span>
                    </div>
                </div>
            `
      )
      .join("");

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

  // 其他模块的占位方法
  loadReminders() {
    console.log("加载教研提醒数据...");
    // TODO: 实现教研提醒数据加载
  }

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

    const html = this.evaluations
      .map((item) => {
        const createdAt = this.formatDateTime(item.created_at);
        const studentName =
          item.student_nickname ||
          item.student?.nickname ||
          item.student ||
          "-";
        const teacherName =
          item.teacher_name || item.teacher?.name || item.teacher || "-";
        const teacherContent = (
          item.content_text ||
          item.teacher_content ||
          ""
        ).toString();
        const researcherFeedback = (item.researcher_feedback || "").toString();

        return `
                    <div class="evaluation-item" data-id="${item.id}">
                        <div class="evaluation-row">
                            <div class="evaluation-col">
                                <div><strong>创建时间：</strong>${
                                  createdAt || "-"
                                }</div>
                                <div><strong>学员：</strong>${studentName}</div>
                                <div><strong>教师：</strong>${teacherName}</div>
                            </div>
                            <div class="evaluation-col">
                                <div><strong>教师点评：</strong><span title="${teacherContent.replace(
                                  /"/g,
                                  "&quot;"
                                )}">${teacherContent || "-"}</span></div>
                                <div><strong>教研反馈：</strong><span title="${researcherFeedback.replace(
                                  /"/g,
                                  "&quot;"
                                )}">${researcherFeedback || "-"}</span></div>
                            </div>
                        </div>
                    </div>
                `;
      })
      .join("");

    container.innerHTML = html;
  }

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

    const html = this.tasks
      .map((t) => {
        const statusText = t.status === "completed" ? "已完成" : "未完成";
        const statusBadge =
          t.status === "completed"
            ? '<span class="badge badge-success">已完成</span>'
            : '<span class="badge badge-warning">未完成</span>';
        const createdAt = t.created_at ? this.formatDateTime(t.created_at) : "";
        const updatedAt = t.updated_at ? this.formatDateTime(t.updated_at) : "";

        return `
            <div class="evaluation-item" data-id="${t.id}">
              <div class="evaluation-meta">
                <div>
                  <strong>学员：</strong>${t.student_nickname || t.student}
                  &nbsp;&nbsp;<strong>负责人：</strong>${
                    t.assignee_name || t.assignee
                  }
                  &nbsp;&nbsp;<strong>状态：</strong>${statusBadge}
                </div>
                <div class="secondary">
                  <span>来源：${t.source === "teacher" ? "教师" : "教研"}</span>
                  &nbsp;&nbsp;<span>创建：${createdAt}</span>
                  &nbsp;&nbsp;<span>更新：${updatedAt}</span>
                </div>
              </div>
              <div class="evaluation-content">
                ${t.note ? this.escapeHtml(t.note) : "<em>无备注</em>"}
              </div>
            </div>
          `;
      })
      .join("");

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
