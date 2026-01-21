# Email Reply Feature

## Overview

邮件系统现在支持回复功能，建立了邮件之间的父子层级关系。用户可以回复已收到的邮件，系统会自动处理发送者和接收者的角色互换。

## Database Schema

### EmailMessage Table

添加了新字段：

```sql
parent_message_id UUID -- 父邮件ID，用于建立回复关系
```

### Relationships

- `parent_message` - belongs_to 关系，指向父邮件
- `sub_messages` - has_many 关系，指向所有子邮件（回复）

## API Usage

### 1. Reply to Email (RPC Action)

**Action:** `EmailMessage.reply_email`

**Parameters:**
```elixir
%{
  parent_message_id: "uuid-of-parent-email",
  sender_user_id: "uuid-of-user-replying",
  subject: "Re: Original Subject",
  body: "Thank you for your email. Here is my reply..."
}
```

**Example:**
```elixir
# 原始邮件：学生 -> 老师
# 老师回复这个邮件
{:ok, reply} = KgEdu.Email.EmailMessage.reply_email(
  %{
    parent_message_id: "original-email-id",
    sender_user_id: "teacher-id",  # 老师的user_id
    subject: "Re: 学生提问",
    body: "你的问题收到了，这里是我的回答..."
  },
  tenant: :org_your_tenant
)
```

### 2. What Happens When Replying

1. **自动角色互换**
   - 原始邮件：学生 -> 老师
   - 回复邮件：老师 -> 学生
   - 系统自动从父邮件获取原始发送者和接收者

2. **建立父子关系**
   - `parent_message_id` 自动设置为被回复的邮件ID
   - 新邮件成为父邮件的子邮件

3. **自动发送**
   - 使用**新的接收者**（原始发送者）的邮箱配置进行认证
   - 显示**新的发送者**（原始接收者）作为发件人
   - 邮件正文标注发送者信息

### 3. Query Email Threads

**获取邮件的所有回复：**
```elixir
# 加载邮件及其子邮件
{:ok, email} = KgEdu.Email.EmailMessage.get_email_message(
  "email-id",
  tenant: :org_your_tenant,
  load: [:sub_messages]
)

# 访问所有回复
email.sub_messages
|> Enum.each(fn reply ->
  IO.puts("Reply from: #{reply.sender.name}")
  IO.puts("Subject: #{reply.subject}")
end)
```

**获取邮件的父邮件：**
```elixir
# 加载邮件及其父邮件
{:ok, email} = KgEdu.Email.EmailMessage.get_email_message(
  "email-id",
  tenant: :org_your_tenant,
  load: [:parent_message]
)

# 访问父邮件
if email.parent_message do
  IO.puts("This is a reply to: #{email.parent_message.subject}")
end
```

### 4. Display Email Threads

**构建完整的邮件树：**
```elixir
def build_email_thread(email) do
  %{
    id: email.id,
    subject: email.subject,
    body: email.body,
    sender: email.sender.name,
    receiver: email.receiver.name,
    sent_at: email.sent_at,
    replies: email.sub_messages |> Enum.map(&build_email_thread/1)
  }
end

# 使用
{:ok, email} = KgEdu.Email.EmailMessage.get_email_message(
  "root-email-id",
  tenant: :org_your_tenant,
  load: [:sub_messages, :parent_message]
)

thread = build_email_thread(email)
```

## Email Thread Example

### Scenario: Student asks question, Teacher replies

**Step 1: Student sends initial email**
```elixir
{:ok, original_email} = KgEdu.Email.EmailMessage.send_email(
  %{
    sender_user_id: "student-id",
    receiver_user_id: "teacher-id",
    subject: "有问题提问",
    body: "老师您好，我对这个问题有疑问..."
  },
  tenant: :org_test
)
# Creates email with parent_message_id = nil
```

**Step 2: Teacher replies**
```elixir
{:ok, reply_email} = KgEdu.Email.EmailMessage.reply_email(
  %{
    parent_message_id: original_email.id,
    sender_user_id: "teacher-id",
    subject: "Re: 有问题提问",
    body: "你的问题是这样的..."
  },
  tenant: :org_test
)
# Creates email with:
# - parent_message_id = original_email.id
# - sender_user_id = teacher-id
# - receiver_user_id = student-id (automatically swapped)
```

**Step 3: Student replies to teacher's reply**
```elixir
{:ok, reply_to_reply} = KgEdu.Email.EmailMessage.reply_email(
  %{
    parent_message_id: reply_email.id,
    sender_user_id: "student-id",
    subject: "Re: Re: 有问题提问",
    body: "谢谢您的解答！"
  },
  tenant: :org_test
)
# Creates email with:
# - parent_message_id = reply_email.id
# - sender_user_id = student-id
# - receiver_user_id = teacher-id (automatically swapped)
```

**Result: Email Thread Structure**
```
原始邮件 (student -> teacher)
└── 回复1 (teacher -> student)
    └── 回复2 (student -> teacher)
```

## Email Content Format

当回复邮件时，系统会在邮件正文中添加上下文信息：

```
【此邮件来自学生】
学生：zhang <18951684111@163.com>

[用户输入的邮件正文]
```

这样接收者可以清楚地知道：
1. 这是一封回复邮件
2. 谁发送的回复
3. 发送者的邮箱地址（用于回复）

## TypeScript Interface

在前端，可以通过 TypeScript RPC 调用：

```typescript
import { EmailMessage } from './ash_rpc';

// Reply to email
const reply = await EmailMessage.replyEmail({
  parentMessageId: 'parent-email-id',
  senderUserId: 'current-user-id',
  subject: 'Re: Original Subject',
  body: 'Reply content...'
});

// Get email with replies
const emailWithReplies = await EmailMessage.getEmailMessage(
  'email-id',
  {
    load: ['subMessages', 'parentMessage', 'sender', 'receiver']
  }
);

console.log(emailWithReplies.subMessages);
```

## Features Summary

✅ **父子层级关系** - 通过 `parent_message_id` 建立邮件线程
✅ **自动角色互换** - 回复时自动交换发送者和接收者
✅ **邮件线程** - 支持多层级回复和嵌套讨论
✅ **关系查询** - 可以查询父邮件和所有子邮件
✅ **RPC Action** - 提供 `reply_email` action 用于回复邮件
✅ **自动发送** - 回复邮件创建后自动发送
✅ **TypeScript支持** - 完整的 TypeScript 类型定义和 RPC 接口

## Use Cases

1. **学生提问，老师回答** - 经典的问答场景
2. **邮件讨论** - 多轮对话和讨论
3. **问题跟进** - 在原有邮件基础上继续讨论
4. **邮件历史** - 追溯完整的邮件对话历史
