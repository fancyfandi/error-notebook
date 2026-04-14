import re

# 读取文件
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

# 3. 在 DOMContentLoaded 中添加答案图片事件监听
answer_image_js = '''
  // 答案图片上传
  const answerImageUpload = document.getElementById("answer-image-upload");
  const answerImageInput = document.getElementById("answer-image-input");

  if (answerImageUpload && answerImageInput) {
    answerImageUpload.addEventListener("click", () => answerImageInput.click());
    answerImageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedAnswerImage = event.target.result;
        answerImageUpload.classList.add("has-image");
        answerImageUpload.innerHTML = `<img src="${uploadedAnswerImage}" alt="答案" style="max-width: 100%; border-radius: 8px;">`;
      };
      reader.readAsDataURL(file);
    });
  }

'''

# 在错误类型标签事件之前插入
content = content.replace(
    '// 错误类型标签',
    answer_image_js + '// 错误类型标签'
)

# 写入文件
with open('/Users/fandishi/error-notebook/app.js', 'w') as f:
    f.write(content)

print("已添加答案图片功能")
