import re

# 读取 app.js
with open('/Users/fandishi/error-notebook/app.js', 'r') as f:
    content = f.read()

# 1. 添加 uploadedAnswerImage 变量
content = content.replace(
    'let uploadedImage = null;',
    'let uploadedImage = null;\nlet uploadedAnswerImage = null;'
)

# 2. 添加 answerImage 到保存数据
content = content.replace(
    'image: uploadedImage',
    'image: uploadedImage,\n      answerImage: uploadedAnswerImage'
)

# 3. 添加答案图片双按钮事件监听（在 DOMContentLoaded 中）
answer_image_js = '''  // 答案图片上传
  const answerImageUpload = document.getElementById("answer-image-upload");
  const answerCameraInput = document.getElementById("answer-camera-input");
  const answerGalleryInput = document.getElementById("answer-gallery-input");
  const btnAnswerCamera = document.getElementById("btn-answer-camera");
  const btnAnswerGallery = document.getElementById("btn-answer-gallery");

  if (btnAnswerCamera && answerCameraInput) {
    btnAnswerCamera.addEventListener("click", () => answerCameraInput.click());
    answerCameraInput.addEventListener("change", (e) => handleAnswerImageSelect(e.target.files[0]));
  }

  if (btnAnswerGallery && answerGalleryInput) {
    btnAnswerGallery.addEventListener("click", () => answerGalleryInput.click());
    answerGalleryInput.addEventListener("change", (e) => handleAnswerImageSelect(e.target.files[0]));
  }

  function handleAnswerImageSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      uploadedAnswerImage = event.target.result;
      if (answerImageUpload) {
        answerImageUpload.classList.add("has-image");
        answerImageUpload.innerHTML = `<img src="${uploadedAnswerImage}" alt="答案" style="max-width: 100%; border-radius: 8px;"><button type="button" id="btn-reselect-answer" style="margin-top: 12px; padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">重新选择</button>`;
        document.getElementById("btn-reselect-answer")?.addEventListener("click", resetAnswerImageUpload);
      }
    };
    reader.readAsDataURL(file);
  }

  function resetAnswerImageUpload() {
    uploadedAnswerImage = null;
    if (answerImageUpload) {
      answerImageUpload.classList.remove("has-image");
      answerImageUpload.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#999" style="margin-bottom: 8px;">
          <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
        </svg>
        <p style="color: #999; font-size: 13px; margin-bottom: 10px;">选择图片来源</p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button type="button" id="btn-answer-camera" style="padding: 6px 12px; background: #4A90D9; color: white; border: none; border-radius: 4px; font-size: 13px;">📷 拍照</button>
          <button type="button" id="btn-answer-gallery" style="padding: 6px 12px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">🖼️ 相册</button>
        </div>
      `;
      // 重新绑定事件
      document.getElementById("btn-answer-camera")?.addEventListener("click", () => answerCameraInput.click());
      document.getElementById("btn-answer-gallery")?.addEventListener("click", () => answerGalleryInput.click());
    }
  }

'''

# 在 DOMContentLoaded 开始处插入
content = content.replace(
    'document.addEventListener(\'DOMContentLoaded\', async () => {',
    'document.addEventListener(\'DOMContentLoaded\', async () => {\n' + answer_image_js
)

# 写入文件
with open('/Users/fandishi/error-notebook/app.js', 'w') as f:
    f.write(content)

print("✅ app.js 已更新：添加答案图片双按钮功能")
