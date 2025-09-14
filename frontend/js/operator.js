// 运营端入口
class OperatorApp {
  constructor() {
    this.currentUser = null;

    // 提醒列表状态
    this.remQuery = {
      page: 1,
      size: 10,
      ordering: "-created_at",
      recipient_me: true,
      include_only_active: true,
      q: "",
      category: "",
      urgency: "",
    };
    this.remPage = { page: 1, size: 10, total: 0 };
    this.reminders = [];

    // 点评记录列表状态
    this.fbQuery = { page: 1, size: 20, ordering: "-created_at", q: "" };
    this.fbPage = { page: 1, size: 20, total: 0 };
    this.feedbacks = [];

    // 学员管理状态
    this.stuQuery = { page: 1, size: 20, q: "" };
    this.stuPage = { page: 1, size: 20, total: 0 };
    this.students = [];
    this.studentTags = [];

    // 回访记录状态
    this.visitQuery = {
      page: 1,
      size: 20,
      ordering: "-created_at",
      q: "",
      status: "",
      urgency: "",
    };
    this.visitPage = { page: 1, size: 20, total: 0 };
    this.visitRecords = [];
  }

  async init() {
    const ok = await Auth.routeGuard("operator");
    if (!ok) return;
    this.currentUser = Auth.getCurrentUser();

    this.bindGlobalEvents();
    this.setupTabs();

    // 初始化侧边栏折叠状态（Notion 风格）
    try {
      const collapsed = Utils.getStorage("ops_sidebar_collapsed");
      if (collapsed === true || collapsed === "true") {
        document.body.classList.add("sidebar-collapsed");
      }
    } catch (_) {}

    // 默认进入提醒列表
    this.switchSection("reminders");

    // 预热标签字典（用于学员编辑）
    this.loadStudentTags().catch(console.error);
    // 初次加载
    this.loadReminders().catch(console.error);
  }

  bindGlobalEvents() {
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", () => Auth.logout());

    // 侧边栏折叠按钮
    const toggleBtn = document.getElementById("sidebarToggleBtn");
    toggleBtn?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
      const isCollapsed = document.body.classList.contains("sidebar-collapsed");
      Utils.setStorage("ops_sidebar_collapsed", isCollapsed, true);
    });

    // sidebar 导航
    document.querySelectorAll(".nav-link[data-section]")?.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.switchSection(section);
      });
    });

    // 提醒区域
    document
      .getElementById("refreshRemindersBtn")
      ?.addEventListener("click", () => this.loadReminders());
    document
      .getElementById("applyRemFiltersBtn")
      ?.addEventListener("click", () => {
        this.remQuery.q = document.getElementById("remQ").value.trim();
        this.remQuery.category = document.getElementById("remCategory").value;
        this.remQuery.urgency = document.getElementById("remUrgency").value;
        this.remQuery.ordering =
          document.getElementById("remOrdering").value || "-created_at";
        this.remQuery.include_only_active =
          !!document.getElementById("remOnlyActive").checked;
        this.remQuery.page = 1;
        this.loadReminders();
      });
    document
      .getElementById("clearRemFiltersBtn")
      ?.addEventListener("click", () => {
        document.getElementById("remQ").value = "";
        document.getElementById("remCategory").value = "";
        document.getElementById("remUrgency").value = "";
        document.getElementById("remOrdering").value = "-created_at";
        document.getElementById("remOnlyActive").checked = true;
        this.remQuery = {
          page: 1,
          size: this.remQuery.size || 10,
          ordering: "-created_at",
          recipient_me: true,
          include_only_active: true,
          q: "",
          category: "",
          urgency: "",
        };
        this.loadReminders();
      });
    document.getElementById("remPrevBtn")?.addEventListener("click", () => {
      if (this.remQuery.page > 1) {
        this.remQuery.page -= 1;
        this.loadReminders();
      }
    });
    document.getElementById("remNextBtn")?.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(this.remPage.total / this.remPage.size)
      );
      if (this.remQuery.page < totalPages) {
        this.remQuery.page += 1;
        this.loadReminders();
      }
    });
    document
      .getElementById("newReminderBtn")
      ?.addEventListener("click", () => this.openReminderModal());

    // 点评列表区域
    document
      .getElementById("refreshFeedbacksBtn")
      ?.addEventListener("click", () => this.loadFeedbacks());
    document
      .getElementById("applyFbFiltersBtn")
      ?.addEventListener("click", () => {
        this.fbQuery.q = document.getElementById("fbQ").value.trim();
        this.fbQuery.ordering =
          document.getElementById("fbOrdering").value || "-created_at";
        this.fbQuery.page = 1;
        this.loadFeedbacks();
      });
    document
      .getElementById("clearFbFiltersBtn")
      ?.addEventListener("click", () => {
        document.getElementById("fbQ").value = "";
        document.getElementById("fbOrdering").value = "-created_at";
        this.fbQuery = {
          page: 1,
          size: this.fbQuery.size || 20,
          ordering: "-created_at",
          q: "",
        };
        this.loadFeedbacks();
      });
    document.getElementById("fbPrevBtn")?.addEventListener("click", () => {
      if (this.fbQuery.page > 1) {
        this.fbQuery.page -= 1;
        this.loadFeedbacks();
      }
    });
    document.getElementById("fbNextBtn")?.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(this.fbPage.total / this.fbPage.size)
      );
      if (this.fbQuery.page < totalPages) {
        this.fbQuery.page += 1;
        this.loadFeedbacks();
      }
    });
    document
      .getElementById("exportFeedbacksBtn")
      ?.addEventListener("click", () => this.exportFeedbacks());

    // 学员管理
    document
      .getElementById("searchStudentsBtn")
      ?.addEventListener("click", () => {
        this.stuQuery.q = document.getElementById("stuQ").value.trim();
        this.stuQuery.page = 1;
        this.loadStudents();
      });
    // 新增：回车触发搜索
    const stuQInput = document.getElementById("stuQ");
    stuQInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.stuQuery.q = stuQInput.value.trim();
        this.stuQuery.page = 1;
        this.loadStudents();
      }
    });
    document
      .getElementById("clearStudentsBtn")
      ?.addEventListener("click", () => {
        document.getElementById("stuQ").value = "";
        this.stuQuery = { page: 1, size: this.stuQuery.size || 20, q: "" };
        this.loadStudents();
      });
    document.getElementById("stuPrevBtn")?.addEventListener("click", () => {
      if (this.stuQuery.page > 1) {
        this.stuQuery.page -= 1;
        this.loadStudents();
      }
    });
    document.getElementById("stuNextBtn")?.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(this.stuPage.total / this.stuPage.size)
      );
      if (this.stuQuery.page < totalPages) {
        this.stuQuery.page += 1;
        this.loadStudents();
      }
    });
    document
      .getElementById("exportStudentsBtn")
      ?.addEventListener("click", () => this.exportStudents());
    document
      .getElementById("newStudentBtn")
      ?.addEventListener("click", () => this.openStudentEditModal(null));
    document
      .getElementById("importStudentsBtn")
      ?.addEventListener("click", () => {
        // 跳转导入页（需求文档路径）
        Utils.redirect("o/students/import"); // 如使用纯静态部署，可替换为相对HTML
      });

    // 回访记录
    document
      .getElementById("refreshVisitsBtn")
      ?.addEventListener("click", () => this.loadVisitRecords());
    document
      .getElementById("applyVisitFiltersBtn")
      ?.addEventListener("click", () => {
        this.visitQuery.q = document.getElementById("visitQ").value.trim();
        this.visitQuery.status = document.getElementById("visitStatus").value;
        this.visitQuery.urgency = document.getElementById("visitUrgency").value;
        this.visitQuery.ordering =
          document.getElementById("visitOrdering").value || "-created_at";
        this.visitQuery.page = 1;
        this.loadVisitRecords();
      });
    document
      .getElementById("clearVisitFiltersBtn")
      ?.addEventListener("click", () => {
        document.getElementById("visitQ").value = "";
        document.getElementById("visitStatus").value = "";
        document.getElementById("visitUrgency").value = "";
        document.getElementById("visitOrdering").value = "-created_at";
        this.visitQuery = {
          page: 1,
          size: this.visitQuery.size || 20,
          ordering: "-created_at",
          q: "",
          status: "",
          urgency: "",
        };
        this.loadVisitRecords();
      });
    document.getElementById("visitPrevBtn")?.addEventListener("click", () => {
      if (this.visitQuery.page > 1) {
        this.visitQuery.page -= 1;
        this.loadVisitRecords();
      }
    });
    document.getElementById("visitNextBtn")?.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(this.visitPage.total / this.visitPage.size)
      );
      if (this.visitQuery.page < totalPages) {
        this.visitQuery.page += 1;
        this.loadVisitRecords();
      }
    });
    document
      .getElementById("newVisitBtn")
      ?.addEventListener("click", () => this.openVisitModal());
  }

  setupTabs() {
    // 初始化时先隐藏所有模块，后续由 switchSection 显示当前模块
    const sections = ["reminders", "feedbacks", "students", "visits"];
    sections.forEach((s) => {
      const el = document.getElementById(`${s}-section`);
      if (el) {
        el.classList.remove("active");
        el.style.display = "none";
      }
    });
  }

  switchSection(sectionKey) {
    const sections = ["reminders", "feedbacks", "students", "visits"];
    sections.forEach((s) => {
      const el = document.getElementById(`${s}-section`);
      if (!el) return;
      if (s === sectionKey) {
        // 显式显示并加 active 类，覆盖样式隐藏
        el.classList.add("active");
        el.style.display = "block";
      } else {
        el.classList.remove("active");
        el.style.display = "none";
      }
    });
    // 激活侧边导航的样式
    document.querySelectorAll(".nav-item").forEach((li) => li.classList.remove("active"));
    const activeLink = document.querySelector(`.nav-link[data-section="${sectionKey}"]`);
    activeLink?.closest(".nav-item")?.classList.add("active");

    // 首次进入每个模块时自动加载数据
    if (sectionKey === "feedbacks" && this.feedbacks.length === 0) this.loadFeedbacks().catch(console.error);
    if (sectionKey === "students" && this.students.length === 0) this.loadStudents().catch(console.error);
    if (sectionKey === "visits" && this.visitRecords.length === 0) this.loadVisitRecords().catch(console.error);
  }

  // ============= 提醒列表 =============
  async loadReminders() {
    const params = {
      page: this.remQuery.page,
      size: this.remQuery.size,
      ordering: this.remQuery.ordering,
      recipient_me: true,
    };
    // 显式带上当前登录用户的 person_id，确保后端过滤生效
    if (this.currentUser && this.currentUser.person_id) {
      params.recipient_id = this.currentUser.person_id;
    }
    if (this.remQuery.q) params.q = this.remQuery.q;
    if (this.remQuery.category) params.category = this.remQuery.category;
    if (this.remQuery.urgency) params.urgency = this.remQuery.urgency;
    if (this.remQuery.include_only_active) params.include_only_active = true;

    const resp = await Utils.get("/api/v1/reminders/", params);

    let items = [];
    let total = 0;
    let page = params.page;
    let size = params.size;

    if (Array.isArray(resp)) {
      items = resp;
      total = resp.length;
      page = 1;
      size = resp.length || size;
    } else if (resp && Array.isArray(resp.items)) {
      items = resp.items;
      total = typeof resp.total === "number" ? resp.total : items.length;
      page = resp.page || page;
      size = resp.size || size;
    } else if (resp && Array.isArray(resp.results)) {
      items = resp.results;
      total = typeof resp.count === "number" ? resp.count : items.length;
    }

    this.reminders = items || [];
    this.remPage = { page, size, total };
    this.renderReminders();
    this.renderRemPagination();
  }

  renderReminders() {
    const container = document.getElementById("opsRemindersList");
    if (!container) return;
    if (!this.reminders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无提醒</h3>
          <p>调整筛选条件或稍后刷新</p>
        </div>`;
      return;
    }

    container.innerHTML = this.reminders
      .map((r) => {
        const created = this.formatDateTime(r.created_at);
        const urgencyBadge = this.getUrgencyBadge(r.urgency || "");
        const urgencyText = this.getUrgencyText(r.urgency || "");
        const categoryText = this.getReminderCategoryText(r.category || "");
        const studentName = this.escapeHtml(
          r.student_nickname || r.student_name || ""
        );
        const studentId =
          typeof r.student === "object" ? r.student?.id ?? null : r.student;
        const studentHtml = studentId
          ? `<a href="#" class="stu-link" data-stu-id="${studentId}">${studentName}</a>`
          : studentName || "-";
        const content = this.escapeHtml(r.content || r.note || "");

        // 曲目刻度渲染（兼容两种字段名）
        let pieceHtml = "";
        const details = Array.isArray(r.feedback_details)
          ? r.feedback_details
          : Array.isArray(r.piece_details)
          ? r.piece_details
          : null;
        if (details && details.length) {
          const lines = details
            .map((d, idx) => {
              const nm = this.escapeHtml(
                d.piece_name || d.piece || `曲目${idx + 1}`
              );
              return `<div class="muted">曲目刻度：${nm}</div>`;
            })
            .join("");
          pieceHtml = `<div class="piece-details">${lines}</div>`;
        }

        return `
        <div class="card reminder-card">
          <div class="card-header">
            <span class="badge ${urgencyBadge}">${urgencyText}</span>
            <span class="muted" style="margin-left:8px;">${categoryText}</span>
            <span class="muted" style="margin-left:auto;">${created}</span>
          </div>
          <div class="card-body">
            <div><strong>学员：</strong>${studentHtml}</div>
            <div style="margin-top:6px;">${content || "-"}</div>
            ${pieceHtml}
          </div>
        </div>
      `;
      })
      .join("");

    // 绑定学员弹窗
    container.querySelectorAll(".stu-link")?.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const sid = a.dataset.stuId;
        if (sid) this.openStudentModal(sid);
      });
    });
  }

  renderRemPagination() {
    const info = document.getElementById("remPageInfo");
    const totalPages = Math.max(
      1,
      Math.ceil(this.remPage.total / this.remPage.size)
    );
    if (info)
      info.textContent = `第 ${this.remPage.page} 页 / 共 ${totalPages} 页（共 ${this.remPage.total} 条）`;
    document.getElementById("remPrevBtn").disabled = this.remQuery.page <= 1;
    document.getElementById("remNextBtn").disabled =
      this.remQuery.page >= totalPages;
  }

  // 简易提醒创建（弹窗）
  async openReminderModal() {
    const modalId = "opsReminderModal";
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = modalId;
      modal.innerHTML = `
        <div class="student-modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;"></div>
        <div class="student-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:680px;max-width:95vw;max-height:80vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.2);z-index:9999;padding:16px 20px;">
          <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:18px;">创建提醒</h3>
            <button id="opsRemCloseBtn" class="btn btn-small btn-secondary">关闭</button>
          </div>
          <div class="modal-body" id="opsRemBody" style="margin-top:12px;">
            <div class="form-row">
              <label>学员（可选）</label>
              <input type="text" id="opsRemStudentSearch" placeholder="搜索学员昵称" />
              <select id="opsRemStudentSelect" size="6" style="width:100%; margin-top:6px;"></select>
            </div>
            <div class="form-row">
              <label>类别</label>
              <select id="opsRemCategory">
                <option value="other">其他</option>
                <option value="poor_effect">教学效果差</option>
                <option value="attitude">态度问题</option>
                <option value="injury">有伤病</option>
              </select>
            </div>
            <div class="form-row">
              <label>紧急度</label>
              <select id="opsRemUrgency">
                <option value="normal">一般</option>
                <option value="urgent">紧急</option>
              </select>
            </div>
            <div class="form-row">
              <label>内容</label>
              <textarea id="opsRemContent" rows="4" placeholder="请输入提醒内容"></textarea>
            </div>
            <div class="form-row">
              <label>接收人（可多选；留空=自发自收）</label>
              <input type="text" id="opsRemRecipientSearch" placeholder="搜索登录用户名" />
              <select id="opsRemRecipientsSelect" multiple size="6" style="width:100%; margin-top:6px;"></select>
              <div class="muted" style="margin-top:6px;">按住 Cmd/Control 可多选；或使用上面的搜索框快速过滤</div>
            </div>
            <div class="form-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="opsRemSubmitBtn">提交</button>
              <span id="opsRemErr" class="muted" style="color:#c00;margin-left:12px;"></span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal
        .querySelector("#opsRemCloseBtn")
        ?.addEventListener("click", () => this.hideModal(modalId));
      modal
        .querySelector(".student-modal-backdrop")
        ?.addEventListener("click", () => this.hideModal(modalId));
      modal
        .querySelector("#opsRemSubmitBtn")
        ?.addEventListener("click", () => this.createReminder());

      // 同时加载：接收人与学员下拉
      await this.populateRecipientsSelect(modal);
      await this.populateStudentSelect(modal);
    }
    modal.style.display = "block";
  }

  async createReminder() {
    const category = document.getElementById("opsRemCategory").value;
    const urgency = document.getElementById("opsRemUrgency").value;
    const content = document.getElementById("opsRemContent").value.trim();
    const recipientsSelect = document.getElementById("opsRemRecipientsSelect");
    const studentSelect = document.getElementById("opsRemStudentSelect");
    const errEl = document.getElementById("opsRemErr");
    errEl.textContent = "";

    try {
      const payload = { category, urgency, content };

      // 选中的学员（可选，单选）
      if (studentSelect && studentSelect.value) {
        payload.student = studentSelect.value;
      }

      // 选中的接收人（可多选）
      if (recipientsSelect) {
        const selected = Array.from(recipientsSelect.selectedOptions || [])
          .map((o) => o.value)
          .filter(Boolean);
        if (selected.length) payload.recipients = selected;
      }

      await Utils.post("/api/v1/reminders/", payload);
      this.hideModal("opsReminderModal");
      await this.loadReminders();
    } catch (e) {
      errEl.textContent = e.message || "创建失败";
    }
  }

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
  }

  // ============= 点评列表 =============
  async loadFeedbacks() {
    const params = {
      page: this.fbQuery.page,
      size: this.fbQuery.size,
      ordering: this.fbQuery.ordering,
    };
    if (this.fbQuery.q) params.q = this.fbQuery.q;

    try {
      const resp = await Utils.get("/api/v1/feedbacks/", params);

      let items = [];
      let total = 0;
      let page = params.page;
      let size = params.size;

      if (Array.isArray(resp)) {
        items = resp;
        total = resp.length;
        page = 1;
        size = resp.length || size;
      } else if (resp && Array.isArray(resp.items)) {
        items = resp.items;
        total = typeof resp.total === "number" ? resp.total : items.length;
        page = resp.page || page;
        size = resp.size || size;
      } else if (resp && Array.isArray(resp.results)) {
        items = resp.results;
        total = typeof resp.count === "number" ? resp.count : items.length;
      }

      this.feedbacks = items || [];
      this.fbPage = { page, size, total };
      this.renderFeedbacks();
      this.renderFbPagination();
    } catch (e) {
      console.error("加载点评失败:", e);
      this.feedbacks = [];
      this.fbPage = { page: 1, size: this.fbQuery.size || 20, total: 0 };
      this.renderFeedbacks();
      this.renderFbPagination();
    }
  }

  renderFeedbacks() {
    const container = document.getElementById("opsFeedbacksList");
    if (!container) return;
    if (!this.feedbacks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无点评记录</h3>
          <p>尝试修改筛选条件</p>
        </div>`;
      return;
    }

    container.innerHTML = this.feedbacks
      .map((f) => {
        const created = this.formatDateTime(f.created_at);
        const teacher = this.escapeHtml(f.teacher_name || f.teacher || "-");
        const student = this.escapeHtml(
          f.student_nickname || f.student_name || "-"
        );
        const studentId =
          typeof f.student === "object" ? f.student?.id ?? null : f.student;
        const studentHtml = studentId
          ? `<a href="#" class="stu-link" data-stu-id="${studentId}">${student}</a>`
          : student;
        const content = this.escapeHtml(
          f.content_text || f.teacher_content || f.content || ""
        );

        // 兼容曲目刻度
        const details = Array.isArray(f.feedback_details)
          ? f.feedback_details
          : Array.isArray(f.piece_details)
          ? f.piece_details
          : null;
        const piecesHtml =
          details && details.length
            ? `<div class="muted">${details
                .map((d, idx) =>
                  this.escapeHtml(d.piece_name || d.piece || `曲目${idx + 1}`)
                )
                .join(" / ")}</div>`
            : "";

        return `
        <div class="card">
          <div class="card-header">
            <strong>${created}</strong>
            <span style="margin-left:8px;">教师：${teacher}</span>
            <span style="margin-left:8px;">学员：${studentHtml}</span>
          </div>
          <div class="card-body">
            <div>${content || "-"}</div>
            ${piecesHtml}
          </div>
        </div>
      `;
      })
      .join("");

    container.querySelectorAll(".stu-link")?.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const sid = a.dataset.stuId;
        if (sid) this.openStudentModal(sid);
      });
    });
  }

  renderFbPagination() {
    const info = document.getElementById("fbPageInfo");
    const totalPages = Math.max(
      1,
      Math.ceil(this.fbPage.total / this.fbPage.size)
    );
    if (info)
      info.textContent = `第 ${this.fbPage.page} 页 / 共 ${totalPages} 页（共 ${this.fbPage.total} 条）`;
    document.getElementById("fbPrevBtn").disabled = this.fbQuery.page <= 1;
    document.getElementById("fbNextBtn").disabled =
      this.fbQuery.page >= totalPages;
  }

  async exportFeedbacks() {
    try {
      await Utils.post("/api/v1/ops/feedbacks/export", {
        q: this.fbQuery.q || "",
        ordering: this.fbQuery.ordering || "-created_at",
      });
      alert("导出任务已提交（占位）");
    } catch (e) {
      alert(`导出失败：${e.message || "请稍后重试"}`);
    }
  }

  // ============= 学员管理 =============
  async loadStudentTags() {
    try {
      const resp = await Utils.get("/api/v1/student-tags/", {
        page: 1,
        size: 1000,
      });
      const items = resp?.results || resp || [];
      this.studentTags = Array.isArray(items) ? items : [];
    } catch (e) {
      console.warn("加载标签失败：", e);
      this.studentTags = [];
    }
  }

  async loadStudents() {
    const params = {
      page: this.stuQuery.page,
      size: this.stuQuery.size,
    };
    // 修改：DRF SearchFilter 使用 search 参数
    if (this.stuQuery.q) params.search = this.stuQuery.q;

    const resp = await Utils.get("/api/v1/students/", params);

    let items = [];
    let total = 0;
    let page = params.page;
    let size = params.size;

    if (Array.isArray(resp)) {
      items = resp;
      total = resp.length;
      page = 1;
      size = resp.length || size;
    } else if (resp && Array.isArray(resp.items)) {
      items = resp.items;
      total = typeof resp.total === "number" ? resp.total : items.length;
      page = resp.page || page;
      size = resp.size || size;
    } else if (resp && Array.isArray(resp.results)) {
      items = resp.results;
      total = typeof resp.count === "number" ? resp.count : items.length;
    }

    this.students = items || [];
    this.stuPage = { page, size, total };
    this.renderStudents();
  }

  renderStudents() {
    const container = document.getElementById("studentsList");
    if (!container) return;
    if (!this.students.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无学员</h3>
          <p>输入关键词搜索</p>
        </div>`;
      return;
    }

    container.innerHTML = this.students
      .map((s) => {
        const nickname = this.escapeHtml(s.nickname || "-");
        const tags = Array.isArray(s.tag_names)
          ? s.tag_names
              .map(
                (t) =>
                  `<span class="badge" style="margin-right:6px;">${this.escapeHtml(
                    t
                  )}</span>`
              )
              .join("")
          : "";
        const opNote = this.escapeHtml(s.op_note || "");
        const id = s.id;

        return `
        <div class="card">
          <div class="card-header">
            <strong>${nickname}</strong>
            <span class="muted" style="margin-left:auto;">ID: ${id}</span>
          </div>
          <div class="card-body">
            <div><strong>标签：</strong>${tags || "-"}</div>
            <div style="margin-top:6px;"><strong>运营备注：</strong>${
              opNote || "-"
            }</div>
            <div style="margin-top:8px;">
              <button class="btn btn-secondary btn-small js-view-stu" data-id="${id}">查看</button>
              <button class="btn btn-primary btn-small js-edit-stu" data-id="${id}">编辑</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    container.querySelectorAll(".js-view-stu")?.forEach((btn) => {
      btn.addEventListener("click", () =>
        this.openStudentModal(btn.dataset.id)
      );
    });
    container.querySelectorAll(".js-edit-stu")?.forEach((btn) => {
      btn.addEventListener("click", () =>
        this.openStudentEditModal(btn.dataset.id)
      );
    });

    const info = document.getElementById("stuPageInfo");
    const totalPages = Math.max(
      1,
      Math.ceil(this.stuPage.total / this.stuPage.size)
    );
    if (info)
      info.textContent = `第 ${this.stuPage.page} 页 / 共 ${totalPages} 页（共 ${this.stuPage.total} 条）`;
    document.getElementById("stuPrevBtn").disabled = this.stuQuery.page <= 1;
    document.getElementById("stuNextBtn").disabled =
      this.stuQuery.page >= totalPages;
  }

  async openStudentEditModal(studentId) {
    const modalId = "opsStudentEditModal";
    let modal = document.getElementById(modalId);
    const isNew = !studentId;

    // 确保标签字典已加载
    if (!this.studentTags || this.studentTags.length === 0) {
      try { await this.loadStudentTags(); } catch (e) { /* 可忽略，渲染空态 */ }
    }

    const render = (stu = {}) => {
      // 只保留一个选中的标签（已有多标签时取第一个）
      const selectedTagId = (() => {
        const first = Array.isArray(stu.tags) && stu.tags.length ? stu.tags[0] : null;
        return first && typeof first === "object" ? first.id : first;
      })();

      const options = [
        `<option value="">未选择标签</option>`,
        ...(this.studentTags || []).map((t) => {
          const selected = String(selectedTagId || "") === String(t.id) ? "selected" : "";
          return `<option value="${t.id}" ${selected}>${this.escapeHtml(t.name || `标签${t.id}`)}</option>`;
        }),
      ].join("");

      modal.innerHTML = `
        <div class="student-modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;"></div>
        <div class="student-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:720px;max-width:95vw;max-height:80vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.2);z-index:9999;padding:16px 20px;">
          <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:18px;">${isNew ? "新增学员" : "编辑学员"}</h3>
            <button id="opsStuCloseBtn" class="btn btn-small btn-secondary">关闭</button>
          </div>
          <div class="modal-body" style="margin-top:12px;">
            <div class="form-row">
              <label>昵称</label>
              <input type="text" id="opsStuNickname" value="${this.escapeAttr(stu.nickname || "")}" />
            </div>
            <div class="form-row">
              <label>备注名</label>
              <input type="text" id="opsStuRemarkName" value="${this.escapeAttr(stu.remark_name || "")}" />
            </div>
            <div class="form-row">
              <label>小鹅通ID</label>
              <input type="text" id="opsStuXetId" value="${this.escapeAttr(stu.xiaoetong_id || "")}" ${isNew ? "" : "disabled"} />
            </div>
            <div class="form-row">
              <label>标签</label>
              <select id="opsStuTags">${options}</select>
            </div>
            <div class="form-row">
              <label>运营备注</label>
              <textarea id="opsStuOpNote" rows="4">${this.escapeAttr(stu.op_note || "")}</textarea>
            </div>
            <div class="form-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="opsStuSaveBtn">${isNew ? "创建" : "保存"}</button>
              <span id="opsStuErr" class="muted" style="color:#c00;margin-left:12px;"></span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector("#opsStuCloseBtn")?.addEventListener("click", () => this.hideModal(modalId));
      modal.querySelector(".student-modal-backdrop")?.addEventListener("click", () => this.hideModal(modalId));
      modal.querySelector("#opsStuSaveBtn")?.addEventListener("click", () => this.saveStudent(studentId));
    };

    if (!modal) modal = document.createElement("div");
    modal.id = modalId;

    if (isNew) {
      render({});
      modal.style.display = "block";
      return;
    }

    // 编辑：先拉详情
    Utils.get(`/api/v1/students/${encodeURIComponent(studentId)}/`)
      .then((stu) => {
        // 统一成 ID 数组
        const tagIds = Array.isArray(stu.tags) ? stu.tags.map((t) => (typeof t === "object" ? t.id : t)) : [];
        render({ ...stu, tags: tagIds });
        modal.style.display = "block";
      })
      .catch((e) => {
        alert(`加载学员失败：${e.message || "请稍后重试"}`);
      });
  }

  async saveStudent(studentId) {
    const nickname = document.getElementById("opsStuNickname").value.trim();
    const remark_name = document
      .getElementById("opsStuRemarkName")
      .value.trim();
    const xiaoetong_id = (document.getElementById("opsStuXetId")?.value || "").trim();
    const tagsSel = document.getElementById("opsStuTags");
    const tagVal = tagsSel ? tagsSel.value : "";
    const op_note = document.getElementById("opsStuOpNote").value.trim();
    const errEl = document.getElementById("opsStuErr");
    errEl.textContent = "";

    // 仅在有有效选择时才携带 tags；否则不在 payload 中包含（避免 [""]）
    const payload = { nickname, remark_name, op_note };
    if (tagVal) payload.tags = [tagVal];
    try {
      if (!studentId) {
        if (!xiaoetong_id) {
          errEl.textContent = "请填写小鹅通ID";
          return;
        }
        await Utils.post("/api/v1/students/", { ...payload, xiaoetong_id });
      } else {
        // 使用 PATCH 局部更新，避免 PUT 触发必填字段校验（如 xiaoetong_id）
        await Utils.patch(
          `/api/v1/students/${encodeURIComponent(studentId)}/`,
          payload
        );
      }
      this.hideModal("opsStudentEditModal");
      await this.loadStudents();
    } catch (e) {
      errEl.textContent = e.message || "保存失败";
    }
  }

  async exportStudents() {
    try {
      await Utils.post("/api/v1/ops/students/export", {
        q: this.stuQuery.q || "",
      });
      alert("导出任务已提交（占位）");
    } catch (e) {
      alert(`导出失败：${e.message || "请稍后重试"}`);
    }
  }

  // ============= 回访记录 =============
  async loadVisitRecords() {
    const params = {
      page: this.visitQuery.page,
      size: this.visitQuery.size,
      ordering: this.visitQuery.ordering,
    };
    if (this.visitQuery.q) params.search = this.visitQuery.q;
    if (this.visitQuery.status) params.status = this.visitQuery.status;
    if (this.visitQuery.urgency) params.urgency = this.visitQuery.urgency;

    const resp = await Utils.get("/api/v1/visit-records/", params);

    let items = [];
    let total = 0;
    let page = params.page;
    let size = params.size;

    if (Array.isArray(resp)) {
      items = resp;
      total = resp.length;
      page = 1;
      size = resp.length || size;
    } else if (resp && Array.isArray(resp.items)) {
      items = resp.items;
      total = typeof resp.total === "number" ? resp.total : items.length;
      page = resp.page || page;
      size = resp.size || size;
    } else if (resp && Array.isArray(resp.results)) {
      items = resp.results;
      total = typeof resp.count === "number" ? resp.count : items.length;
    }

    this.visitRecords = items || [];
    this.visitPage = { page, size, total };
    this.renderVisitRecords();
  }

  renderVisitRecords() {
    const container = document.getElementById("visitRecordsList");
    if (!container) return;
    if (!this.visitRecords.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>暂无回访记录</h3>
          <p>尝试修改筛选条件</p>
        </div>`;
      return;
    }

    container.innerHTML = this.visitRecords
      .map((v) => {
        const created = this.formatDateTime(v.created_at);
        const nextAt = v.next_follow_up_at
          ? this.formatDateTime(v.next_follow_up_at)
          : "-";
        const urgencyBadge = this.getUrgencyBadge(v.urgency || "");
        const urgencyText = this.getUrgencyText(v.urgency || "");
        const studentName = this.escapeHtml(
          v.student_nickname || v.student_name || ""
        );
        const studentId =
          typeof v.student === "object" ? v.student?.id ?? null : v.student;
        const studentHtml = studentId
          ? `<a href="#" class="stu-link" data-stu-id="${studentId}">${studentName}</a>`
          : studentName || "-";
        const content = this.escapeHtml(v.content || "");
        const statusText = this.escapeHtml(v.status || "-");
        return `
        <div class="card">
          <div class="card-header">
            <span class="badge ${urgencyBadge}">${urgencyText}</span>
            <span style="margin-left:8px;">状态：${statusText}</span>
            <span class="muted" style="margin-left:auto;">创建：${created}</span>
          </div>
          <div class="card-body">
            <div><strong>学员：</strong>${studentHtml}</div>
            <div style="margin-top:6px;">${content || "-"}</div>
            <div class="muted" style="margin-top:6px;">下次回访：${nextAt}</div>
            <div style="margin-top:8px;">
              <button class="btn btn-primary btn-small js-edit-visit" data-id="${
                v.id
              }">编辑</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // 事件
    container.querySelectorAll(".stu-link")?.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const sid = a.dataset.stuId;
        if (sid) this.openStudentModal(sid);
      });
    });
    container.querySelectorAll(".js-edit-visit")?.forEach((btn) => {
      btn.addEventListener("click", () => this.openVisitModal(btn.dataset.id));
    });

    const info = document.getElementById("visitPageInfo");
    const totalPages = Math.max(
      1,
      Math.ceil(this.visitPage.total / this.visitPage.size)
    );
    if (info)
      info.textContent = `第 ${this.visitPage.page} 页 / 共 ${totalPages} 页（共 ${this.visitPage.total} 条）`;
    document.getElementById("visitPrevBtn").disabled =
      this.visitQuery.page <= 1;
    document.getElementById("visitNextBtn").disabled =
      this.visitQuery.page >= totalPages;
  }

  async openVisitModal(visitId = null) {
    const modalId = "opsVisitModal";
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = modalId;
      document.body.appendChild(modal);
    }

    const render = async (v = {}) => {
      const selectedStuId = typeof v.student === "object" ? v.student?.id : v.student || null;

      modal.innerHTML = `
        <div class="student-modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;"></div>
        <div class="student-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:720px;max-width:95vw;max-height:80vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.2);z-index:9999;padding:16px 20px;">
          <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:18px;">${visitId ? "编辑回访" : "新建回访"}</h3>
            <button id="opsVisitCloseBtn" class="btn btn-small btn-secondary">关闭</button>
          </div>
          <div class="modal-body" style="margin-top:12px;">
            <div class="form-row">
              <label>学员</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" id="opsVisitStuSearch" placeholder="输入昵称搜索" style="flex:1;" />
                <select id="opsVisitStuSelect" style="flex:1;"></select>
              </div>
            </div>
            <div class="form-row">
              <label>紧急度</label>
              <select id="opsVisitUrgency">
                <option value="">未设置</option>
                <option value="high" ${v.urgency === "high" ? "selected" : ""}>高</option>
                <option value="medium" ${v.urgency === "medium" ? "selected" : ""}>中</option>
                <option value="low" ${v.urgency === "low" ? "selected" : ""}>低</option>
              </select>
            </div>
            <div class="form-row">
              <label>状态</label>
              <select id="opsVisitStatus">
                <option value="pending" ${v.status === "pending" ? "selected" : ""}>未处理</option>
                <option value="done" ${v.status === "done" ? "selected" : ""}>已处理</option>
                <option value="closed" ${v.status === "closed" ? "selected" : ""}>已关闭</option>
              </select>
            </div>
            <div class="form-row">
              <label>需要跟进</label>
              <input type="checkbox" id="opsVisitNeed" ${v.need_follow_up ? "checked" : ""} />
            </div>
            <div class="form-row">
              <label>下次回访时间</label>
              <input type="datetime-local" id="opsVisitNext" />
            </div>
            <div class="form-row">
              <label>回访内容</label>
              <textarea id="opsVisitContent" rows="4">${this.escapeAttr(v.content || "")}</textarea>
            </div>
            <div class="form-row">
              <label>回访结果</label>
              <textarea id="opsVisitResult" rows="3">${this.escapeAttr(v.result || "")}</textarea>
            </div>
            <div class="form-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="opsVisitSaveBtn">${visitId ? "保存" : "创建"}</button>
              <span id="opsVisitErr" class="muted" style="color:#c00;margin-left:12px;"></span>
            </div>
          </div>
        </div>
      `;
      // 回填 datetime-local
      if (v.next_follow_up_at) {
        const d = new Date(v.next_follow_up_at);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        modal.querySelector("#opsVisitNext").value = d.toISOString().slice(0, 16);
      }
      modal.querySelector("#opsVisitCloseBtn")?.addEventListener("click", () => this.hideModal(modalId));
      modal.querySelector(".student-modal-backdrop")?.addEventListener("click", () => this.hideModal(modalId));
      modal.querySelector("#opsVisitSaveBtn")?.addEventListener("click", () => this.saveVisit(visitId));

      // 学员选择器：加载与预选
      await this.populateStudentSelectGeneric(modal, "#opsVisitStuSelect", "#opsVisitStuSearch", selectedStuId);
    };

    if (!visitId) {
      await render({});
      modal.style.display = "block";
      return;
    }

    try {
      const v = await Utils.get(`/api/v1/visit-records/${encodeURIComponent(visitId)}/`);
      await render(v || {});
      modal.style.display = "block";
    } catch (e) {
      alert(`加载回访失败：${e.message || "请稍后重试"}`);
    }
  }

  async saveVisit(visitId = null) {
    const errEl = document.getElementById("opsVisitErr");
    errEl.textContent = "";

    // 从下拉获取所选学员
    const stuSel = document.getElementById("opsVisitStuSelect");
    const studentId = stuSel ? (stuSel.value || "").trim() : "";

    const payload = {
      student: studentId,
      urgency: document.getElementById("opsVisitUrgency").value || null,
      status: document.getElementById("opsVisitStatus").value || "pending",
      need_follow_up: document.getElementById("opsVisitNeed").checked,
      content: document.getElementById("opsVisitContent").value.trim(),
      result: document.getElementById("opsVisitResult").value.trim(),
      next_follow_up_at: (() => {
        const v = document.getElementById("opsVisitNext").value;
        return v ? new Date(v).toISOString() : null;
      })(),
      operator: this?.currentUser?.person_id || null,
    };

    try {
      if (!payload.student) {
        errEl.textContent = "请选择学员";
        return;
      }
      if (!payload.operator) {
        errEl.textContent = "未获取到当前人员信息，请重新登录后重试";
        return;
      }
      if (!visitId) {
        await Utils.post("/api/v1/visit-records/", payload);
      } else {
        await Utils.put(`/api/v1/visit-records/${encodeURIComponent(visitId)}/`, payload);
      }
      this.hideModal("opsVisitModal");
      await this.loadVisitRecords();
    } catch (e) {
      errEl.textContent = e.message || "保存失败";
    }
  }

  // ============= 学员详情弹窗（复用教师端样式与逻辑） =============
  async openStudentModal(studentId) {
    if (!studentId) return;

    let modal = document.getElementById("studentInfoModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "studentInfoModal";
      document.body.appendChild(modal);
    }

    // 先渲染加载态
    modal.innerHTML = `
      <div class="student-modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;"></div>
      <div class="student-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:720px;max-width:94vw;max-height:80vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,0.2);z-index:9999;padding:16px 20px;">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;font-size:18px;">学员详情</h3>
          <button id="stuInfoCloseBtn" class="btn btn-small btn-secondary">关闭</button>
        </div>
        <div class="modal-body" style="margin-top:12px;">
          加载中...
        </div>
      </div>
    `;
    modal.style.display = "block";
    modal
      .querySelector("#stuInfoCloseBtn")
      ?.addEventListener("click", () => this.hideModal("studentInfoModal"));
    modal
      .querySelector(".student-modal-backdrop")
      ?.addEventListener("click", () => this.hideModal("studentInfoModal"));

    try {
      const [stu, fbResp] = await Promise.all([
        Utils.get(`/api/v1/students/${encodeURIComponent(studentId)}/`),
        Utils.get("/api/v1/feedbacks/", {
          page: 1,
          size: 10,
          ordering: "-created_at",
          student: studentId,
        }),
      ]);

      // 解析反馈列表返回结构
      let fbs = [];
      if (Array.isArray(fbResp)) {
        fbs = fbResp;
      } else if (fbResp && Array.isArray(fbResp.items)) {
        fbs = fbResp.items;
      } else if (fbResp && Array.isArray(fbResp.results)) {
        fbs = fbResp.results;
      }

      const nickname = this.escapeHtml(stu?.nickname || "-");
      const remarkName = this.escapeHtml(stu?.remark_name || "");
      const opNote = this.escapeHtml(stu?.op_note || "");
      const tagNames = Array.isArray(stu?.tag_names) ? stu.tag_names : [];
      const tagsHtml = tagNames
        .map(
          (t) =>
            `<span class="badge" style="margin-right:6px;">${this.escapeHtml(
              t
            )}</span>`
        )
        .join("");

      const fbListHtml = fbs.length
        ? fbs
            .map((f) => {
              const created = this.formatDateTime(f.created_at);
              const teacher = this.escapeHtml(
                f.teacher_name || f.teacher || "-"
              );
              const content = this.escapeHtml(
                f.content_text || f.teacher_content || f.content || ""
              );
              const details = Array.isArray(f.feedback_details)
                ? f.feedback_details
                : Array.isArray(f.piece_details)
                ? f.piece_details
                : null;
              const pieces =
                details && details.length
                  ? `<div class="muted">${details
                      .map((d, idx) =>
                        this.escapeHtml(
                          d.piece_name || d.piece || `曲目${idx + 1}`
                        )
                      )
                      .join(" / ")}</div>`
                  : "";
              return `
              <div class="card">
                <div class="card-header">
                  <strong>${created}</strong>
                  <span style="margin-left:8px;">教师：${teacher}</span>
                </div>
                <div class="card-body">
                  <div>${content || "-"}</div>
                  ${pieces}
                </div>
              </div>
            `;
            })
            .join("")
        : `<div class="empty-state">
             <h3>暂无最近点评</h3>
             <p>该学员还没有点评记录</p>
           </div>`;

      modal.querySelector(".modal-body").innerHTML = `
        <div>
          <div style="display:flex;align-items:center;">
            <h3 style="margin:0;">${nickname}</h3>
            <span class="muted" style="margin-left:8px;">ID: ${
              stu?.id ?? "-"
            }</span>
          </div>
          ${
            remarkName
              ? `<div class="muted" style="margin-top:4px;">备注名：${remarkName}</div>`
              : ""
          }
          <div style="margin-top:8px;"><strong>标签：</strong>${
            tagsHtml || "-"
          }</div>
          <div style="margin-top:8px;"><strong>运营备注：</strong>${
            opNote || "-"
          }</div>
        </div>
        <hr />
        <div>
          <h4 style="margin:6px 0 10px;">最近点评</h4>
          ${fbListHtml}
        </div>
      `;
    } catch (e) {
      modal.querySelector(".modal-body").innerHTML = `
        <div class="empty-state">
          <h3>加载失败</h3>
          <p>${this.escapeHtml(e.message || "请稍后重试")}</p>
        </div>
      `;
    }
  }

  // 新增：接收人选择下拉加载与搜索
  async populateRecipientsSelect(modal) {
    try {
      const selectEl = modal.querySelector("#opsRemRecipientsSelect");
      const searchEl = modal.querySelector("#opsRemRecipientSearch");
      if (!selectEl) return;

      // 先放一个“加载中”
      selectEl.innerHTML = "";
      const loadingOpt = document.createElement("option");
      loadingOpt.textContent = "正在加载人员...";
      loadingOpt.disabled = true;
      selectEl.appendChild(loadingOpt);

      // 拉取人员列表（支持数组或分页返回）
      const resp = await Utils.get("/api/persons/", { page: 1, size: 200 });
      let items = [];
      if (Array.isArray(resp)) {
        items = resp;
      } else if (resp && Array.isArray(resp.results)) {
        items = resp.results;
      }

      // 渲染选项：以 username 为主显示
      selectEl.innerHTML = "";
      for (const p of items) {
        const opt = document.createElement("option");
        opt.value = String(p.id);
        const username = (p.username || "").trim();
        // 展示为 “username #id”，若无 username 则仅显示 “#id”
        opt.textContent = username ? `${username} #${p.id}` : `#${p.id}`;
        // 用 data-username 存小写用户名，供过滤使用
        opt.dataset.username = (username || "").toLowerCase();
        selectEl.appendChild(opt);
      }

      // 搜索：仅按 username 过滤
      if (searchEl) {
        searchEl.addEventListener("input", () => {
          const q = searchEl.value.trim().toLowerCase();
          Array.from(selectEl.options).forEach((opt) => {
            const uname = opt.dataset.username || "";
            opt.style.display = q ? (uname.includes(q) ? "" : "none") : "";
          });
        });
      }
    } catch (e) {
      const selectEl = modal.querySelector("#opsRemRecipientsSelect");
      if (selectEl) {
        selectEl.innerHTML = "";
        const errOpt = document.createElement("option");
        errOpt.textContent = "加载人员失败，请重试";
        errOpt.disabled = true;
        selectEl.appendChild(errOpt);
      }
      console.error(e);
    }
  }

  // 兼容原有：提醒弹窗使用的学员下拉（委托到通用方法）
  async populateStudentSelect(modal) {
    return this.populateStudentSelectGeneric(
      modal,
      "#opsRemStudentSelect",
      "#opsRemStudentSearch",
      null
    );
  }

  // 通用：学员搜索 + 单选（可预选）
  async populateStudentSelectGeneric(root, selectSelector, searchSelector, preselectId = null) {
    const selectEl = root.querySelector(selectSelector);
    const searchEl = root.querySelector(searchSelector);
    if (!selectEl) return;

    const renderOptions = (items = []) => {
      selectEl.innerHTML = "";
      for (const s of items) {
        const opt = document.createElement("option");
        opt.value = String(s.id);
        const nickname = (s.nickname || "").trim();
        opt.textContent = nickname ? `${nickname} #${s.id}` : `#${s.id}`;
        opt.dataset.nickname = (nickname || "").toLowerCase();
        selectEl.appendChild(opt);
      }
      if (preselectId) {
        selectEl.value = String(preselectId);
      }
    };

    try {
      const resp = await Utils.get("/api/v1/students/", { page: 1, size: 50 });
      const items = Array.isArray(resp?.results) ? resp.results : Array.isArray(resp) ? resp : [];
      renderOptions(items);

      // 若需要预选且初次列表中不存在该项，则单独补充
      if (preselectId && !Array.from(selectEl.options).some(o => o.value === String(preselectId))) {
        try {
          const stu = await Utils.get(`/api/v1/students/${encodeURIComponent(preselectId)}/`);
          if (stu && stu.id) {
            const opt = document.createElement("option");
            opt.value = String(stu.id);
            const nickname = (stu.nickname || "").trim();
            opt.textContent = nickname ? `${nickname} #${stu.id}` : `#${stu.id}`;
            opt.dataset.nickname = (nickname || "").toLowerCase();
            selectEl.appendChild(opt);
            selectEl.value = String(stu.id);
          }
        } catch {}
      }
    } catch (e) {
      selectEl.innerHTML = "";
      const errOpt = document.createElement("option");
      errOpt.textContent = "加载学员失败，请重试";
      errOpt.disabled = true;
      selectEl.appendChild(errOpt);
      console.error(e);
    }

    // 输入即查（debounce）
    if (searchEl) {
      let timer = null;
      searchEl.addEventListener("input", () => {
        const q = searchEl.value.trim();
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const resp = await Utils.get("/api/v1/students/", { page: 1, size: 50, ...(q ? { search: q } : {}) });
            const items = Array.isArray(resp?.results) ? resp.results : Array.isArray(resp) ? resp : [];
            renderOptions(items);
          } catch (e) {
            console.error(e);
          }
        }, 300);
      });
    }
  }

  // ============= 工具方法 =============
  formatDateTime(v) {
    if (!v) return "-";
    try {
      const d = new Date(v);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    } catch {
      return String(v);
    }
  }

  getUrgencyBadge(u) {
    const key = String(u || "").toLowerCase();
    if (key === "urgent") return "badge-danger";
    if (key === "normal") return "badge-warning";
    return "badge-secondary";
  }

  getUrgencyText(u) {
    const key = String(u || "").toLowerCase();
    if (key === "urgent") return "紧急";
    if (key === "normal") return "一般";
    return "未设";
  }

  getReminderCategoryText(c) {
    const key = String(c || "").toLowerCase();
    const map = {
      poor_effect: "教学效果差",
      attitude: "学员态度问题",
      injury: "有伤病",
      other: "其他",
    };
    return map[key] || key || "-";
  }

  escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  escapeAttr(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  // ... existing code ...
}
  
  // 页面启动入口
  document.addEventListener("DOMContentLoaded", () => {
    const app = new OperatorApp();
    app.init().catch(console.error);
  });