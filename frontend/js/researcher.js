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
      piece_id: "",
      ordering: "-created_at",
    };
    this.evalPage = { page: 1, size: 20, total: 0 };

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
    const selectPiece = document.getElementById("pieceFilter");
    const selectSort = document.getElementById("sortBy");

    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        this.evalQuery.q = (inputQ?.value || "").trim();
        this.evalQuery.start = inputStart?.value || "";
        this.evalQuery.end = inputEnd?.value || "";
        this.evalQuery.teacher_id = (selectTeacher?.value || "").trim();
        this.evalQuery.course_id = (selectCourse?.value || "").trim();
        this.evalQuery.piece_id = (selectPiece?.value || "").trim();
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
        if (selectPiece) selectPiece.value = "";
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
          piece_id: "",
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
        // 先初始化筛选下拉（只做一次）
        if (!this.evalFiltersLoaded) {
          this.initEvaluationFilters().finally(() => {
            this.loadEvaluations();
          });
        } else {
          this.loadEvaluations();
        }
        break;
      case "statistics":
        this.loadStatistics();
        break;
    }
  }

  // 公告管理相关方法
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
      if (this.evalQuery.piece_id) params.piece_id = this.evalQuery.piece_id;
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

  // 模态框相关方法
  async initEvaluationFilters() {
    try {
      await Promise.all([this.loadTeacherOptions(), this.loadCourseOptions()]);
      // 课程变更时联动曲目
      const courseSelect = document.getElementById("courseFilter");
      if (courseSelect) {
        courseSelect.addEventListener("change", async () => {
          const courseId = courseSelect.value || "";
          await this.loadPieceOptions(courseId);
        });
        // 初次如果已存在默认课程，联动一次
        if (courseSelect.value) {
          await this.loadPieceOptions(courseSelect.value);
        } else {
          this.clearPieceOptions(); // 清空曲目
        }
      }
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

  async loadPieceOptions(courseId) {
    const select = document.getElementById("pieceFilter");
    if (!select) return;
    if (!courseId) {
      this.clearPieceOptions();
      return;
    }
    try {
      // 用课程下的曲目动作：/api/courses/{id}/pieces/
      const items = await Utils.get(`/api/courses/${courseId}/pieces/`, {});
      const options = ['<option value="">全部曲目</option>'].concat(
        (items || []).map((p) => `<option value="${p.id}">${p.name}</option>`)
      );
      select.innerHTML = options.join("");
    } catch (e) {
      console.error("加载曲目列表失败:", e);
      this.clearPieceOptions();
    }
  }

  clearPieceOptions() {
    const select = document.getElementById("pieceFilter");
    if (select) {
      select.innerHTML = '<option value="">全部曲目</option>';
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
}

// 页面加载完成后初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ResearcherApp();
});

// 筛选/查询事件绑定（点评管理）
const searchBtn = document.getElementById('evalSearchBtn');
const resetBtn = document.getElementById('evalResetBtn');
const inputQ = document.getElementById('evalSearchInput');
const inputStart = document.getElementById('evalStartDate');
const inputEnd = document.getElementById('evalEndDate');
const inputTeacherId = document.getElementById('evalTeacherId');
const inputStudentId = document.getElementById('evalStudentId');
const inputCourseId = document.getElementById('evalCourseId');
const inputPieceId = document.getElementById('evalPieceId');
const selectOrdering = document.getElementById('evalOrdering');
const selectPageSize = document.getElementById('evalPageSize');
const prevBtn = document.getElementById('evalPrevPage');
const nextBtn = document.getElementById('evalNextPage');

const isValidUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const studentVal = (inputStudentId?.value || '').trim();
        if (studentVal && !isValidUUID(studentVal)) {
            this.showError('学员ID不是有效的UUID');
            return;
        }
        this.evalQuery.q = (inputQ?.value || '').trim();
        this.evalQuery.start = inputStart?.value || '';
        this.evalQuery.end = inputEnd?.value || '';
        this.evalQuery.teacher_id = (inputTeacherId?.value || '').trim();
        this.evalQuery.student_id = studentVal;
        this.evalQuery.course_id = (inputCourseId?.value || '').trim();
        this.evalQuery.piece_id = (inputPieceId?.value || '').trim();
        this.evalQuery.ordering = selectOrdering?.value || '-created_at';
        // 页码重置
        this.evalQuery.page = 1;
        // 每页条数
        if (selectPageSize?.value) {
            const sz = parseInt(selectPageSize.value, 10);
            if (!Number.isNaN(sz) && sz > 0) this.evalQuery.size = sz;
        }
        this.loadEvaluations();
    });
}
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (inputQ) inputQ.value = '';
        if (inputStart) inputStart.value = '';
        if (inputEnd) inputEnd.value = '';
        if (inputTeacherId) inputTeacherId.value = '';
        if (inputStudentId) inputStudentId.value = '';
        if (inputCourseId) inputCourseId.value = '';
        if (inputPieceId) inputPieceId.value = '';
        if (selectOrdering) selectOrdering.value = '-created_at';
        if (selectPageSize) selectPageSize.value = '20';
        this.evalQuery = { q: '', start: '', end: '', page: 1, size: 20, teacher_id: '', student_id: '', course_id: '', piece_id: '', ordering: '-created_at' };
        this.loadEvaluations();
    });
}
if (inputQ) {
    inputQ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchBtn?.click();
        }
    });
}
if (selectPageSize) {
    selectPageSize.addEventListener('change', () => {
        const sz = parseInt(selectPageSize.value, 10);
        if (!Number.isNaN(sz) && sz > 0) {
            this.evalQuery.size = sz;
            this.evalQuery.page = 1;
            this.loadEvaluations();
        }
    });
}
if (selectOrdering) {
    selectOrdering.addEventListener('change', () => {
        this.evalQuery.ordering = selectOrdering.value || '-created_at';
        this.evalQuery.page = 1;
        this.loadEvaluations();
    });
}
if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (this.evalPage.page > 1) {
            this.evalQuery.page = this.evalPage.page - 1;
            this.loadEvaluations();
        }
    });
}
if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(this.evalPage.total / this.evalPage.size));
        if (this.evalPage.page < totalPages) {
            this.evalQuery.page = this.evalPage.page + 1;
            this.loadEvaluations();
        }
    });
}
