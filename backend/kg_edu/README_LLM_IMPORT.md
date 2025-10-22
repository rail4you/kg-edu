# LLM Knowledge Import 功能

这个功能实现了从文本中通过LLM分析导入知识点和知识关系的需求。

## 功能概述

1. **文本输入**: 接收中文文本作为输入
2. **LLM分析**: 使用ReqLLM和OpenRouter模型分析文本
3. **JSON提取**: LLM识别知识点、学科、单元、知识细胞及其关系，输出JSON格式
4. **事务处理**: Elixir使用JSON创建知识点和知识关系，支持事务和回滚
5. **测试用例**: 包含完整的测试脚本
6. **中文示例**: 提供中文演示文本

## 使用方法

### 1. 基本使用

```elixir
# 确保API密钥已配置
export OPENROUTER_API_KEY="your-api-key-here"

# 启动应用
iex -S mix phx.server

# 在IEx中运行演示（使用默认课程ID）
KgEdu.Demo.ImportFromLLM.run_demo()

# 或者指定特定的课程ID
KgEdu.Demo.ImportFromLLM.run_demo("your-course-id-here")
```

### 2. 代码接口调用

```elixir
alias KgEdu.Knowledge.ImportFromLLM

# 准备中文文本
text = """
物理学是一门研究物质、能量及其相互作用的自然科学。物理学包含多个重要的分支学科，
其中力学是最基础和重要的分支之一。
"""

# 导入知识点
{:ok, course} = KgEdu.Courses.Course.get_course_by_title(%{title: "你的课程名"})

case ImportFromLLM.import_from_text(text, course.id) do
  {:ok, result} ->
    IO.puts("导入成功!")
    IO.puts("知识点: #{length(result.resources)}")
    IO.puts("关系: #{length(result.relations)}")
    
  {:error, reason} ->
    IO.puts("导入失败: #{inspect(reason)}")
end
```

### 3. 测试脚本

```bash
# 运行测试脚本（使用默认课程ID: faf6950f-b50d-4c0a-b09f-fd989dfd13e1）
mix run test_llm_import.exs

# 或者修改脚本中的course_id变量来使用不同的课程
```

### 4. RPC调用

该功能已添加到Ash Typescript RPC接口，前端可以调用：

```typescript
// 前端调用示例
const result = await rpc.call('Knowledge', 'import_knowledge_from_llm', {
  text: '中文文本内容',
  courseId: 'course-uuid'
});
```

## 文件结构

```
lib/kg_edu/knowledge/
├── import_from_llm.ex          # 核心导入逻辑
├── resource.ex                 # 知识点资源（已添加import_from_llm动作）
└── relation.ex                 # 知识关系（使用现有逻辑）

lib/kg_edu/demo/
└── import_from_llm.ex          # 演示脚本

test/kg_edu/knowledge/
└── import_from_llm_test.exs    # 测试用例

test_llm_import.exs             # 独立测试脚本
```

## 配置要求

1. **环境变量**:
   ```bash
   export OPENROUTER_API_KEY="your-openrouter-api-key"
   ```

2. **配置文件** (config/config.exs):
   ```elixir
   config :kg_edu, :reqllm,
     api_key: System.get_env("OPENROUTER_API_KEY"),
     model: "openrouter:z-ai/glm-4.5"
   ```

## LLM提示词

LLM接收的提示词要求它：

1. 识别文本中的层级结构（学科->单元->知识点）
2. 识别知识点之间的逻辑关系（前置条件、包含关系、相关关系等）
3. 为关系选择合适的类型名称
4. 确保所有名称在文本中能找到对应
5. 使用中文回复
6. 返回有效的JSON格式

## JSON输出格式

LLM需要输出以下JSON格式：

```json
{
  "knowledge_resources": [
    {
      "name": "知识点名称",
      "type": "subject|knowledge_unit|knowledge_cell",
      "subject": "所属学科名称",
      "unit": "所属单元名称（如果适用）",
      "description": "知识点描述",
      "importance_level": "hard|important|normal"
    }
  ],
  "relations": [
    {
      "source_knowledge": "源知识点名称",
      "target_knowledge": "目标知识点名称", 
      "relation_type": "关系类型名称（如：prerequisite、includes、related_to等）"
    }
  ]
}
```

## 事务处理

- 使用`Ash.DataLayer.transaction/3`确保操作的原子性
- 如果创建知识点或关系失败，整个操作会回滚
- 支持现有的授权和上下文传递

## 错误处理

1. **LLM分析失败**: 返回详细的错误信息
2. **JSON解析失败**: 处理格式错误和缺失字段
3. **数据库操作失败**: 事务回滚并返回错误
4. **验证失败**: 检查必要字段和数据类型

## 测试

1. **单元测试**: `test/kg_edu/knowledge/import_from_llm_test.exs`
2. **集成测试**: 需要真实API密钥的完整流程测试
3. **演示脚本**: `lib/kg_edu/demo/import_from_llm.ex`

## 示例输出

运行演示脚本后，您会看到类似这样的输出：

```
🚀 Starting LLM Knowledge Import Demo
==================================================
✅ Using course: LLM导入演示课程

📝 Input Chinese Text:
------------------------------
[中文文本内容]
------------------------------

🤖 Analyzing text with LLM...
✅ Successfully imported knowledge!

📚 Imported Knowledge Resources (5):
📖 物理学 🟡
   Type: subject
   Subject: 物理学
   Description: 基础学科

📚 力学 🟡
   Type: knowledge_unit
   Subject: 物理学
   Unit: 力学
   Description: 物理学的重要分支

📄 牛顿力学 🔴
   Type: knowledge_cell
   Subject: 物理学
   Unit: 力学
   Description: 经典力学的基础

🔗 Imported Relations (3):
• 力学
  → includes
  → 牛顿力学

📊 Summary:
• Knowledge Resources: 5
  - Subjects: 1
  - Units: 1  
  - Knowledge Cells: 3
• Relations: 3

🎉 Demo completed!
```

## 注意事项

1. **API密钥**: 确保OpenRouter API密钥有效且有足够配额
2. **网络连接**: 需要能访问OpenRouter API
3. **JSON格式**: LLM响应需要严格按照JSON格式，代码会进行验证
4. **中文字符**: 确保系统支持UTF-8编码
5. **事务大小**: 对于大量知识点，可能需要考虑分批处理

## 扩展功能

- 支持英文文本分析
- 自定义关系类型
- 批量导入优化
- 导入进度跟踪
- 冲突处理策略