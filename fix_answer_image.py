import re

with open('/Users/fandishi/error-notebook/index.html', 'r') as f:
    content = f.read()

# 查找并替换答案图片区域
old_pattern = r'<div style="margin-top: 12px;" id="answer-image-section">.*?<input type="file" accept="image/\*" capture="environment" id="answer-image-input" style="display: none;">\s*</div>\s*</div>'

new_html = '''                <div style="margin-top: 12px;" id="answer-image-section">
                    <label class="form-label" style="font-size: 14px; color: #666;">答案图片（可选）</label>
                    <div id="answer-image-preview-area">
                        <div class="image-upload" id="answer-image-upload" style="padding: 20px;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#999" style="margin-bottom: 8px;">
                                <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
                            </svg>
                            <p style="color: #999; font-size: 13px; margin-bottom: 10px;">选择图片来源</p>
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button type="button" id="btn-answer-camera" style="padding: 6px 12px; background: #4A90D9; color: white; border: none; border-radius: 4px; font-size: 13px;">📷 拍照</button>
                                <button type="button" id="btn-answer-gallery" style="padding: 6px 12px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">🖼️ 相册</button>
                            </div>
                        </div>
                    </div>
                    <input type="file" accept="image/*" capture="environment" id="answer-camera-input" style="display: none;">
                    <input type="file" accept="image/*" id="answer-gallery-input" style="display: none;">
                </div>'''

# 尝试简单替换
if 'id="answer-image-section"' in content:
    # 找到旧代码并替换
    start_marker = '<div style="margin-top: 12px;" id="answer-image-section">'
    start_idx = content.find(start_marker)
    if start_idx != -1:
        # 找到这个div的结束位置
        end_marker = '</div>'
        # 找这个section的结束（需要找到配对的结束标签）
        depth = 0
        i = start_idx
        while i < len(content):
            if content[i:i+5] == '<div ' or content[i:i+5] == '<div>':
                depth += 1
            elif content[i:i+6] == '</div>':
                depth -= 1
                if depth == 0:
                    # 找到了配对的结束标签
                    end_idx = i + 6
                    break
            i += 1

        # 替换
        new_content = content[:start_idx] + new_html + content[end_idx:]

        with open('/Users/fandishi/error-notebook/index.html', 'w') as f:
            f.write(new_content)
        print("已更新答案图片区域")
    else:
        print("未找到标记")
else:
    print("未找到答案图片区域")
