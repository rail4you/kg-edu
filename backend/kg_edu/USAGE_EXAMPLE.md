# LLM Knowledge Import 使用示例

## 快速开始

使用指定的课程ID (`faf6950f-b50d-4c0a-b09f-fd989dfd13e1`) 测试LLM知识导入功能：

### 方法1: 运行演示脚本
```bash
# 启动Phoenix服务器
iex -S mix phx.server

# 在IEx中运行演示
KgEdu.Demo.ImportFromLLM.run_demo()
```

### 方法2: 运行测试脚本
```bash
mix run test_llm_import.exs
```

### 方法3: 自定义文本测试
```elixir
# 在IEx中运行
text = """
数学分析是高等数学的一个重要分支，主要包括极限理论、微积分和级数理论。
在学习数学分析时，需要先掌握函数的基本概念和性质，然后学习极限和连续性，
接着学习微分学和积分学，最后学习级数理论。
"""

KgEdu.Demo.ImportFromLLM.test_with_text(text)
```

## 输出示例

```
🚀 Starting LLM Knowledge Import Demo
==================================================
✅ Using course: 高等数学 (ID: faf6950f-b50d-4c0a-b09f-fd989dfd13e1)

📝 Input Chinese Text:
------------------------------
数学分析是高等数学的一个重要分支，主要包括极限理论、微积分和级数理论。
在学习数学分析时，需要先掌握函数的基本概念和性质，然后学习极限和连续性，
接着学习微分学和积分学，最后学习级数理论。
------------------------------

🤖 Analyzing text with LLM...
✅ Successfully imported knowledge!

📚 Imported Knowledge Resources (6):
📖 数学分析 🟡
   Type: subject
   Subject: 数学分析
   Description: 高等数学的一个重要分支

📚 微积分 🔴
   Type: knowledge_unit
   Subject: 数学分析
   Unit: 微积分
   Description: 包括微分学和积分学

📄 极限理论 ⚪
   Type: knowledge_cell
   Subject: 数学分析
   Unit: 微积分
   Description: 研究函数极限的理论

🔗 Imported Relations (3):
• 函数概念
  → prerequisite
  → 极限理论

• 极限理论
  → includes
  → 微积分学

📊 Summary:
• Knowledge Resources: 6
  - Subjects: 1
  - Units: 1
  - Knowledge Cells: 4
• Relations: 3

🎉 Demo completed!
```

## 注意事项

- 确保API密钥已配置: `export OPENROUTER_API_KEY="your-key"`
- 确保指定的课程ID存在于数据库中
- 知识点和关系都会关联到指定的课程
- 支持事务处理，失败时会自动回滚