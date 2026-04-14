// ==================== 薄弱知识点分析 ====================

// 分析薄弱知识点
async function analyzeWeakPoints() {
  const all = await getAllErrors();

  if (all.length === 0) {
    return null;
  }

  // 按知识点分组统计
  const chapterStats = {};
  const subjectStats = {};
  const errorTypeStats = {};

  all.forEach(error => {
    // 知识点统计
    const key = error.chapter || '未分类';
    if (!chapterStats[key]) {
      chapterStats[key] = {
        chapter: key,
        subject: error.subject,
        count: 0,
        masterySum: 0,
        errorTypes: {}
      };
    }
    chapterStats[key].count++;
    chapterStats[key].masterySum += error.masteryLevel;
    if (error.errorType) {
      chapterStats[key].errorTypes[error.errorType] = (chapterStats[key].errorTypes[error.errorType] || 0) + 1;
    }

    // 学科统计
    if (!subjectStats[error.subject]) {
      subjectStats[error.subject] = { count: 0, masterySum: 0 };
    }
    subjectStats[error.subject].count++;
    subjectStats[error.subject].masterySum += error.masteryLevel;

    // 错误类型统计
    if (error.errorType) {
      errorTypeStats[error.errorType] = (errorTypeStats[error.errorType] || 0) + 1;
    }
  });

  // 计算平均掌握程度并排序
  const chapterList = Object.values(chapterStats).map(stat => ({
    ...stat,
    avgMastery: (stat.masterySum / stat.count).toFixed(1),
    weakness: calculateWeakness(stat.count, stat.masterySum / stat.count)
  }));

  // 按薄弱程度排序（掌握程度低 + 错题多）
  chapterList.sort((a, b) => b.weakness - a.weakness);

  return {
    total: all.length,
    weakPoints: chapterList.filter(c => c.avgMastery < 3 && c.count >= 2),
    allChapters: chapterList,
    subjectStats,
    errorTypeStats
  };
}

// 计算薄弱程度（错题数 * (5 - 平均掌握程度)）
function calculateWeakness(count, avgMastery) {
  return count * (5 - avgMastery);
}

// 显示薄弱知识点分析报告
async function showWeakPointsReport() {
  const report = await analyzeWeakPoints();

  if (!report) {
    alert('还没有错题数据，无法分析');
    return;
  }

  const subjectNames = {
    math: '数学', chinese: '语文', english: '英语',
    physics: '物理', chemistry: '化学', biology: '生物',
    history: '历史', geography: '地理', politics: '政治'
  };

  const typeNames = {
    concept: '概念不清', careless: '粗心大意', method: '方法不会',
    calculation: '计算错误', understand: '题意理解'
  };

  let html = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: flex-end;" onclick="this.remove()">
      <div style="background: white; width: 100%; max-height: 85%; border-radius: 20px 20px 0 0; padding: 20px; overflow-y: auto;" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; color: #333;">📊 薄弱知识点分析</h2>
          <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
        </div>

        <div style="background: #f0f7ff; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
          <p style="color: #666; font-size: 14px;">共记录 <strong style="color: #4A90D9;">${report.total}</strong> 道错题</p>
        </div>
  `;

  // 薄弱知识点列表
  if (report.weakPoints.length > 0) {
    html += `<h3 style="font-size: 16px; color: #ff4d4f; margin-bottom: 12px;">⚠️ 需要重点加强（${report.weakPoints.length}个）</h3>`;
    html += `<div style="margin-bottom: 24px;">`;

    report.weakPoints.forEach((point, index) => {
      const mainErrorType = Object.entries(point.errorTypes)
        .sort((a, b) => b[1] - a[1])[0];

      html += `
        <div style="background: #fff2f0; border-left: 4px solid #ff4d4f; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 15px; color: #333;">${index + 1}. ${point.chapter}</strong>
            <span style="background: #ff4d4f; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${subjectNames[point.subject] || point.subject}</span>
          </div>
          <div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
            <span>❌ ${point.count} 道错题</span>
            <span>📊 掌握度 ${point.avgMastery}/5</span>
            ${mainErrorType ? `<span>🔍 主要问题：${typeNames[mainErrorType[0]] || mainErrorType[0]}</span>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // 所有知识点掌握情况
  html += `<h3 style="font-size: 16px; color: #333; margin-bottom: 12px;">📚 全部知识点掌握情况</h3>`;
  html += `<div style="margin-bottom: 24px;">`;

  report.allChapters.forEach(point => {
    const masteryColor = point.avgMastery >= 4 ? '#52C41A' : point.avgMastery >= 2.5 ? '#FAAD14' : '#ff4d4f';
    const masteryText = point.avgMastery >= 4 ? '良好' : point.avgMastery >= 2.5 ? '一般' : '薄弱';

    html += `
      <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="flex: 1;">
          <div style="font-size: 14px; color: #333; margin-bottom: 4px;">${point.chapter}</div>
          <div style="font-size: 12px; color: #999;">${subjectNames[point.subject] || point.subject} · ${point.count}道题</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; color: ${masteryColor}; font-weight: 500;">${masteryText}</div>
          <div style="font-size: 12px; color: #999;">掌握度 ${point.avgMastery}/5</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  // 学习建议
  html += `
    <div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 16px; border-radius: 8px;">
      <h4 style="font-size: 15px; color: #52C41A; margin-bottom: 8px;">💡 学习建议</h4>
      <ul style="font-size: 13px; color: #666; line-height: 1.8; padding-left: 16px;">
        ${report.weakPoints.length > 0 ? `<li>优先复习「${report.weakPoints[0].chapter}」等薄弱知识点</li>` : ''}
        <li>每天复习错题，提高掌握程度</li>
        <li>针对错误类型进行专项训练</li>
        <li>已掌握的错题也要定期回顾</li>
      </ul>
    </div>
  `;

  html += `</div></div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}
