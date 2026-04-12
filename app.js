// ==================== IndexedDB 初始化 ====================
const DB_NAME = 'ErrorNotebookDB';
const DB_VERSION = 1;
const STORE_NAME = 'errors';

let db = null;

// 打开数据库
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('subject', 'subject', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('masteryLevel', 'masteryLevel', { unique: false });
        store.createIndex('nextReview', 'nextReview', { unique: false });
      }
    };
  });
}

// ==================== 错题数据操作 ====================

// 添加错题
async function addError(errorData) {
  const error = {
    ...errorData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    masteryLevel: 0, // 0-5 级掌握程度
    reviewCount: 0,
    nextReview: Date.now(), // 下次复习时间
    lastReview: null
  };

  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.add(error);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 获取所有错题
async function getAllErrors() {
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.reverse()); // 最新的在前
    request.onerror = () => reject(request.error);
  });
}

// 按学科筛选
async function getErrorsBySubject(subject) {
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('subject');
  return new Promise((resolve, reject) => {
    const request = index.getAll(subject);
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

// 获取需要复习的错题
async function getReviewErrors() {
  const now = Date.now();
  const all = await getAllErrors();
  return all.filter(e => e.nextReview <= now && e.masteryLevel < 5);
}

// 更新错题
async function updateError(id, updates) {
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const data = { ...getReq.result, ...updates, updatedAt: Date.now() };
      const putReq = store.put(data);
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// 更新掌握程度
async function updateMastery(id, level) {
  // 计算下次复习时间（基于艾宾浩斯遗忘曲线）
  const intervals = [1, 2, 4, 7, 15, 30]; // 天
  const days = intervals[Math.min(level, 5)] || 30;
  const nextReview = Date.now() + days * 24 * 60 * 60 * 1000;

  return updateError(id, {
    masteryLevel: level,
    reviewCount: (await getErrorById(id)).reviewCount + 1,
    lastReview: Date.now(),
    nextReview
  });
}

// 获取单个错题
async function getErrorById(id) {
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 删除错题
async function deleteError(id) {
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 获取统计数据
async function getStats() {
  const all = await getAllErrors();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    total: all.length,
    mastered: all.filter(e => e.masteryLevel >= 5).length,
    review: all.filter(e => e.nextReview <= Date.now() && e.masteryLevel < 5).length,
    today: all.filter(e => e.createdAt >= today.getTime()).length
  };
}

// 导出数据
async function exportData() {
  const all = await getAllErrors();
  const data = {
    version: 1,
    exportTime: new Date().toISOString(),
    errors: all
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `错题本备份_${new Date().toLocaleDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入数据
async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.errors && Array.isArray(data.errors)) {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          for (const error of data.errors) {
            delete error.id; // 删除原ID，让数据库重新分配
            await new Promise((res, rej) => {
              const req = store.add(error);
              req.onsuccess = () => res();
              req.onerror = () => rej(req.error);
            });
          }
          resolve(data.errors.length);
        } else {
          reject(new Error('无效的数据格式'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ==================== UI 操作 ====================

// 当前状态
let currentPage = 'home';
let currentFilter = 'all';
let uploadedImage = null;
let reviewQueue = [];
let currentReviewIndex = 0;

// 页面切换
function switchPage(page) {
  currentPage = page;

  // 更新页面显示
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  // 控制添加按钮显示
  const fab = document.getElementById('fab-add');
  fab.style.display = page === 'home' || page === 'list' ? 'flex' : 'none';

  // 加载页面数据
  if (page === 'home') loadHome();
  if (page === 'list') loadList();
  if (page === 'review') loadReview();
}

// 加载首页
async function loadHome() {
  const stats = await getStats();
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-mastered').textContent = stats.mastered;
  document.getElementById('stat-review').textContent = stats.review;
  document.getElementById('stat-today').textContent = stats.today;

  // 加载最近错题
  const errors = await getAllErrors();
  const recent = errors.slice(0, 5);
  const container = document.getElementById('recent-errors');

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
        <p>还没有错题，点击右下角 + 添加</p>
      </div>
    `;
  } else {
    container.innerHTML = recent.map(e => renderErrorCard(e)).join('');
  }
}

// 加载列表页
async function loadList() {
  let errors;
  if (currentFilter === 'all') {
    errors = await getAllErrors();
  } else if (currentFilter === 'review') {
    errors = await getReviewErrors();
  } else {
    errors = await getErrorsBySubject(currentFilter);
  }

  const container = document.getElementById('error-list');
  if (errors.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无错题</p></div>';
  } else {
    container.innerHTML = errors.map(e => renderErrorCard(e)).join('');
  }
}

// 渲染错题卡片
function renderErrorCard(error) {
  const subjectNames = {
    math: '数学', chinese: '语文', english: '英语',
    physics: '物理', chemistry: '化学', biology: '生物',
    history: '历史', geography: '地理', politics: '政治'
  };

  const typeNames = {
    concept: '概念不清', careless: '粗心大意', method: '方法不会',
    calculation: '计算错误', understand: '题意理解'
  };

  const date = new Date(error.createdAt).toLocaleDateString();

  // 掌握程度圆点
  let masteryDots = '';
  for (let i = 1; i <= 5; i++) {
    masteryDots += `<div class="mastery-dot ${i <= error.masteryLevel ? 'active' : ''}"></div>`;
  }

  return `
    <div class="error-card" onclick="showErrorDetail(${error.id})">
      ${error.image ? `<img src="${error.image}" class="error-card-image" alt="">` : ''}
      <div class="error-card-content">
        <span class="error-card-subject subject-${error.subject}">${subjectNames[error.subject] || error.subject}</span>
        <div class="error-card-title">${error.description || '无描述'}</div>
        <div class="error-card-meta">
          <span>${error.chapter || ''} ${error.errorType ? typeNames[error.errorType] : ''}</span>
          <div class="mastery-level" title="掌握程度">${masteryDots}</div>
        </div>
      </div>
    </div>
  `;
}

// 显示错题详情
async function showErrorDetail(id) {
  const error = await getErrorById(id);
  if (!error) return;

  const subjectNames = { math: '数学', chinese: '语文', english: '英语', physics: '物理', chemistry: '化学', biology: '生物', history: '历史', geography: '地理', politics: '政治' };
  const typeNames = { concept: '概念不清', careless: '粗心大意', method: '方法不会', calculation: '计算错误', understand: '题意理解' };

  const detailHtml = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end;" onclick="this.remove()">
      <div style="background: white; width: 100%; max-height: 80%; border-radius: 20px 20px 0 0; padding: 20px; overflow-y: auto;" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 18px;">错题详情</h3>
          <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
        </div>
        ${error.image ? `<img src="${error.image}" style="width: 100%; border-radius: 8px; margin-bottom: 16px;">` : ''}
        <div style="margin-bottom: 12px;">
          <span style="color: #666;">学科：</span>${subjectNames[error.subject] || error.subject}
        </div>
        ${error.chapter ? `<div style="margin-bottom: 12px;"><span style="color: #666;">知识点：</span>${error.chapter}</div>` : ''}
        ${error.errorType ? `<div style="margin-bottom: 12px;"><span style="color: #666;">错误类型：</span>${typeNames[error.errorType]}</div>` : ''}
        ${error.description ? `<div style="margin-bottom: 12px;"><span style="color: #666;">描述：</span>${error.description}</div>` : ''}
        ${error.answer ? `<div style="margin-bottom: 16px; background: #f5f5f5; padding: 12px; border-radius: 8px;"><span style="color: #666;">答案：</span><div style="margin-top: 4px;">${error.answer}</div></div>` : ''}
        <div style="display: flex; gap: 12px;">
          <button onclick="deleteAndClose(${error.id})" style="flex: 1; padding: 12px; border: 1px solid #ff4d4f; background: white; color: #ff4d4f; border-radius: 8px; cursor: pointer;">删除</button>
          <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="flex: 1; padding: 12px; border: none; background: #4A90D9; color: white; border-radius: 8px; cursor: pointer;">关闭</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', detailHtml);
}

async function deleteAndClose(id) {
  if (confirm('确定删除这道错题吗？')) {
    await deleteError(id);
    document.querySelector('[style*="position: fixed"]').remove();
    loadHome();
    loadList();
  }
}

// 加载复习页
async function loadReview() {
  reviewQueue = await getReviewErrors();
  currentReviewIndex = 0;
  showCurrentReview();
}

function showCurrentReview() {
  const container = document.getElementById('review-container');

  if (reviewQueue.length === 0 || currentReviewIndex >= reviewQueue.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <p>太棒了！暂时没有需要复习的错题</p>
        <p style="font-size: 14px; margin-top: 8px;">已复习 ${reviewQueue.length} 道题</p>
      </div>
    `;
    return;
  }

  const error = reviewQueue[currentReviewIndex];
  const subjectNames = { math: '数学', chinese: '语文', english: '英语', physics: '物理', chemistry: '化学', biology: '生物', history: '历史', geography: '地理', politics: '政治' };

  container.innerHTML = `
    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <span style="color: #666;">${subjectNames[error.subject]} · ${currentReviewIndex + 1}/${reviewQueue.length}</span>
      <button onclick="showAnswer()" style="padding: 8px 16px; background: #4A90D9; color: white; border: none; border-radius: 6px; cursor: pointer;">看答案</button>
    </div>
    <div class="review-card">
      <div class="review-image">
        ${error.image ? `<img src="${error.image}" alt="">` : '<p style="color: #999;">无图片</p>'}
      </div>
      ${error.description ? `<div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px;">${error.description}</div>` : ''}
      <div id="answer-section" style="display: none; margin-bottom: 16px; padding: 12px; background: #f6ffed; border-radius: 8px;">
        <strong>答案：</strong><br>${error.answer || '暂无答案'}
      </div>
      <div class="review-actions">
        <button class="review-btn review-btn-forget" onclick="handleReview('forget')">完全不会</button>
        <button class="review-btn review-btn-vague" onclick="handleReview('vague')">有点模糊</button>
        <button class="review-btn review-btn-master" onclick="handleReview('master')">已掌握</button>
      </div>
    </div>
  `;
}

function showAnswer() {
  document.getElementById('answer-section').style.display = 'block';
}

async function handleReview(result) {
  const error = reviewQueue[currentReviewIndex];
  let newLevel = error.masteryLevel;

  if (result === 'forget') {
    newLevel = 0;
  } else if (result === 'vague') {
    newLevel = Math.max(0, newLevel - 1);
  } else if (result === 'master') {
    newLevel = Math.min(5, newLevel + 1);
  }

  await updateMastery(error.id, newLevel);
  currentReviewIndex++;
  showCurrentReview();
}

// ==================== 事件绑定 ====================

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化数据库
  db = await openDB();

  // 注册 Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  // 底部导航
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });

  // 添加按钮
  document.getElementById('fab-add').addEventListener('click', () => {
    switchPage('add');
  });

  // 筛选
  document.querySelectorAll('.filter-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentFilter = item.dataset.filter;
      loadList();
    });
  });

  // 图片上传处理函数
  function handleImageSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      uploadedImage = event.target.result;
      const previewArea = document.getElementById('image-preview-area');
      previewArea.innerHTML = `
        <div class="image-upload has-image">
          <img src="${uploadedImage}" alt="题目" style="max-width: 100%; border-radius: 8px;">
          <button type="button" id="btn-reselect" style="margin-top: 12px; padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">重新选择</button>
        </div>
      `;
      // 重新选择按钮事件
      setTimeout(() => {
        document.getElementById('btn-reselect')?.addEventListener('click', resetImageUpload);
      }, 0);
    };
    reader.readAsDataURL(file);
  }

  // 重置图片上传区域
  function resetImageUpload() {
    uploadedImage = null;
    const previewArea = document.getElementById('image-preview-area');
    previewArea.innerHTML = `
      <div class="image-upload" id="image-upload">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="#999" style="margin-bottom: 8px;">
          <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
        </svg>
        <p style="color: #999; margin-bottom: 12px;">选择图片来源</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button type="button" id="btn-camera" style="padding: 8px 16px; background: #4A90D9; color: white; border: none; border-radius: 6px; font-size: 14px;">
            📷 拍照
          </button>
          <button type="button" id="btn-gallery" style="padding: 8px 16px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
            🖼️ 相册
          </button>
        </div>
      </div>
    `;
    bindImageButtons();
  }

  // 绑定图片按钮事件
  function bindImageButtons() {
    document.getElementById('btn-camera')?.addEventListener('click', () => {
      document.getElementById('camera-input').click();
    });
    document.getElementById('btn-gallery')?.addEventListener('click', () => {
      document.getElementById('gallery-input').click();
    });
  }

  // 初始化绑定
  bindImageButtons();

  // 相机输入
  document.getElementById('camera-input').addEventListener('change', (e) => {
    handleImageSelect(e.target.files[0]);
  });

  // 相册输入
  document.getElementById('gallery-input').addEventListener('change', (e) => {
    handleImageSelect(e.target.files[0]);
  });

  // 错误类型标签
  document.querySelectorAll('#error-types .tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('#error-types .tag').forEach(t => t.classList.remove('selected'));
      tag.classList.add('selected');
    });
  });

  // 保存错题
  document.getElementById('btn-save').addEventListener('click', async () => {
    const subject = document.getElementById('subject').value;
    if (!subject) {
      alert('请选择学科');
      return;
    }

    const selectedTag = document.querySelector('#error-types .tag.selected');

    const errorData = {
      subject,
      chapter: document.getElementById('chapter').value,
      errorType: selectedTag?.dataset.type || '',
      description: document.getElementById('description').value,
      answer: document.getElementById('answer').value,
      image: uploadedImage
    };

    await addError(errorData);

    // 重置表单
    document.getElementById('subject').value = '';
    document.getElementById('chapter').value = '';
    document.getElementById('description').value = '';
    document.getElementById('answer').value = '';
    resetImageUpload();
    document.querySelectorAll('#error-types .tag').forEach(t => t.classList.remove('selected'));

    alert('保存成功！');
    switchPage('home');
  });

  // 导出/导入
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-input').click();
  });
  document.getElementById('import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const count = await importData(file);
      alert(`成功导入 ${count} 道错题`);
      loadHome();
      loadList();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });

  // PDF导出功能
  let pdfSubjectFilter = 'all';
  document.querySelectorAll('#pdf-subject-filter .filter-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#pdf-subject-filter .filter-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      pdfSubjectFilter = item.dataset.subject;
    });
  });

  document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    const previewArea = document.getElementById('pdf-preview-area');
    previewArea.style.display = 'block';
    previewArea.innerHTML = '<p style="color: #666; font-size: 13px; margin-top: 8px;">正在生成PDF...</p>';

    try {
      // 获取错题数据
      let errors;
      if (pdfSubjectFilter === 'all') {
        errors = await getAllErrors();
      } else {
        errors = await getErrorsBySubject(pdfSubjectFilter);
      }

      if (errors.length === 0) {
        alert('该学科暂时没有错题');
        previewArea.style.display = 'none';
        return;
      }

      // 生成PDF
      await generatePDF(errors, pdfSubjectFilter);
      previewArea.innerHTML = '<p style="color: #52C41A; font-size: 13px; margin-top: 8px;">PDF生成成功！</p>';
      setTimeout(() => previewArea.style.display = 'none', 3000);
    } catch (err) {
      console.error(err);
      previewArea.innerHTML = `<p style="color: #ff4d4f; font-size: 13px; margin-top: 8px;">生成失败：${err.message}</p>`;
    }
  });

  // 加载首页数据
  loadHome();
});

// 生成PDF函数
async function generatePDF(errors, subjectFilter) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const subjectNames = {
    math: '数学', chinese: '语文', english: '英语',
    physics: '物理', chemistry: '化学', biology: '生物',
    history: '历史', geography: '地理', politics: '政治',
    all: '全部学科'
  };

  // 标题
  doc.setFontSize(20);
  doc.text('中考错题本', 105, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.text(`${subjectNames[subjectFilter] || subjectFilter} - 共${errors.length}道错题`, 105, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`导出时间：${new Date().toLocaleString()}`, 105, 38, { align: 'center' });

  let yPos = 50;
  const pageHeight = 280;

  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];

    // 检查是否需要新页面
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // 错题序号和学科
    doc.setFontSize(12);
    doc.setTextColor(74, 144, 217);
    doc.text(`第 ${i + 1} 题 [${subjectNames[error.subject] || error.subject}]`, 20, yPos);
    yPos += 8;

    // 知识点
    if (error.chapter) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`知识点：${error.chapter}`, 20, yPos);
      yPos += 6;
    }

    // 题目描述
    if (error.description) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const descLines = doc.splitTextToSize(`题目：${error.description}`, 170);
      doc.text(descLines, 20, yPos);
      yPos += descLines.length * 5 + 3;
    }

    // 图片
    if (error.image) {
      try {
        // 计算图片尺寸，最大宽度170mm
        const imgWidth = 80;
        const imgHeight = 60;

        if (yPos + imgHeight > pageHeight) {
          doc.addPage();
          yPos = 20;
        }

        doc.addImage(error.image, 'JPEG', 20, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 5;
      } catch (e) {
        console.log('图片添加失败', e);
      }
    }

    // 答案
    if (error.answer) {
      doc.setFontSize(10);
      doc.setTextColor(82, 196, 26);
      const answerLines = doc.splitTextToSize(`答案：${error.answer}`, 170);
      doc.text(answerLines, 20, yPos);
      yPos += answerLines.length * 5 + 3;
    }

    // 错误类型
    const typeNames = {
      concept: '概念不清', careless: '粗心大意', method: '方法不会',
      calculation: '计算错误', understand: '题意理解'
    };
    if (error.errorType) {
      doc.setFontSize(9);
      doc.setTextColor(250, 173, 20);
      doc.text(`错误类型：${typeNames[error.errorType] || error.errorType}`, 20, yPos);
      yPos += 5;
    }

    // 分隔线
    yPos += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
  }

  // 保存PDF
  const fileName = `错题本_${subjectNames[subjectFilter] || subjectFilter}_${new Date().toLocaleDateString()}.pdf`;
  doc.save(fileName);
}
