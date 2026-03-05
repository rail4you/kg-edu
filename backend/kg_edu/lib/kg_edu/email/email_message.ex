defmodule KgEdu.Email.EmailMessage do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Email,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  postgres do
    table("email_messages")
    repo(KgEdu.Repo)
  end

  json_api do
    type("email_message")
  end

  typescript do
    type_name("EmailMessage")
  end

  code_interface do
    define(:list_email_messages, action: :read)
    define(:get_email_message, action: :by_id)
    define(:list_sent_messages, action: :by_sender)
    define(:list_received_messages, action: :by_receiver)
    define(:create_email_message, action: :create)
    define(:send_email, action: :send_email)
    define(:reply_email, action: :reply_email)
    define(:mark_as_sent, action: :mark_as_sent)
    define(:mark_as_failed, action: :mark_as_failed)
    define(:mark_as_read, action: :mark_as_read)
  end

  actions do
    defaults([:read, :destroy])

    read :by_id do
      description("Get an email message by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    read :by_sender do
      description("Get all email messages sent by a user")
      argument(:sender_user_id, :uuid, allow_nil?: false)
      filter(expr(sender_user_id == ^arg(:sender_user_id)))

      prepare(fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end)
    end

    read :by_receiver do
      description("Get all email messages received by a user")
      argument(:receiver_user_id, :uuid, allow_nil?: false)
      filter(expr(receiver_user_id == ^arg(:receiver_user_id)))

      prepare(fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end)
    end

    create :create do
      description("Create a new email message (doesn't send it)")
      accept([:subject, :body, :parent_message_id])

      argument :sender_user_id, :uuid do
        allow_nil?(false)
        description("The user ID sending the email")
      end

      argument :receiver_user_id, :uuid do
        allow_nil?(false)
        description("The user ID receiving the email")
      end

      change(set_attribute(:sender_user_id, arg(:sender_user_id)))
      change(set_attribute(:receiver_user_id, arg(:receiver_user_id)))
      change(set_attribute(:status, :pending))
    end

    update :mark_as_sent do
      description("Mark email as successfully sent")
      accept([])
      change(set_attribute(:status, :sent))
      change(set_attribute(:sent_at, &DateTime.utc_now/0))
    end

    update :mark_as_failed do
      description("Mark email as failed to send")
      accept([:error_message])
      change(set_attribute(:status, :failed))
      change(set_attribute(:failed_at, &DateTime.utc_now/0))
    end

    update :mark_as_read do
      description("Mark email as read")
      accept([])
      change(set_attribute(:read_status, :read))
      change(set_attribute(:read_at, &DateTime.utc_now/0))
    end

    create :send_email do
      description("Create and send an email message")
      accept([:subject, :body, :parent_message_id])

      argument :sender_user_id, :uuid do
        allow_nil?(false)
        description("The user ID sending the email")
      end

      argument :receiver_user_id, :uuid do
        allow_nil?(false)
        description("The user ID receiving the email")
      end

      change(set_attribute(:sender_user_id, arg(:sender_user_id)))
      change(set_attribute(:receiver_user_id, arg(:receiver_user_id)))
      change(set_attribute(:status, :sending))

      # After creating the message, send the email
      change(fn changeset, context ->
        Ash.Changeset.after_action(changeset, fn _changeset, email_message ->
          Logger.info("[EMAIL AFTER_ACTION] Starting email send for message: #{email_message.id}")

          case KgEdu.Email.EmailSender.send_email(email_message, tenant: context.tenant) do
            {:ok, :sent} ->
              Logger.info(
                "[EMAIL AFTER_ACTION] EmailSender returned :sent, updating message status"
              )

              # Update status to sent
              case email_message
                   |> Ash.Changeset.for_update(:mark_as_sent)
                   |> Ash.update(actor: context.actor, authorize?: false, tenant: context.tenant) do
                {:ok, updated_message} ->
                  Logger.info("[EMAIL AFTER_ACTION] Successfully updated message to sent")
                  {:ok, updated_message}

                {:error, update_error} ->
                  Logger.error(
                    "[EMAIL AFTER_ACTION] Failed to update message to sent: #{inspect(update_error)}"
                  )

                  {:ok, email_message}
              end

            {:error, reason} ->
              Logger.error(
                "[EMAIL AFTER_ACTION] EmailSender failed: #{inspect(reason)}, updating message to failed"
              )

              # Update status to failed
              case email_message
                   |> Ash.Changeset.for_update(:mark_as_failed, %{error_message: inspect(reason)})
                   |> Ash.update(actor: context.actor, authorize?: false, tenant: context.tenant) do
                {:ok, updated_message} ->
                  Logger.info("[EMAIL AFTER_ACTION] Successfully updated message to failed")
                  {:ok, updated_message}

                {:error, update_error} ->
                  Logger.error(
                    "[EMAIL AFTER_ACTION] Failed to update message to failed: #{inspect(update_error)}"
                  )

                  {:ok, email_message}
              end
          end
        end)
      end)
    end

    create :reply_email do
      description("Reply to an existing email message")
      accept([:subject, :body])

      argument :parent_message_id, :uuid do
        allow_nil?(false)
        description("The ID of the parent email message being replied to")
      end

      argument :sender_user_id, :uuid do
        allow_nil?(false)
        description("The user ID sending the reply")
      end

      change(set_attribute(:parent_message_id, arg(:parent_message_id)))
      change(set_attribute(:status, :sending))

      # Get parent message and set reply direction
      # Reply goes from original receiver back to original sender
      change(fn changeset, context ->
        parent_id = Ash.Changeset.get_argument(changeset, :parent_message_id)
        replier_id = Ash.Changeset.get_argument(changeset, :sender_user_id)

        # Load parent message to get original sender and receiver
        case __MODULE__.get_email_message(%{id: parent_id},
               tenant: context.tenant,
               authorize?: false,
               load: [:sender, :receiver]
             ) do
          {:ok, parent_message} ->
            original_sender_id = parent_message.sender_user_id
            original_receiver_id = parent_message.receiver_user_id

            # For a reply, the direction is reversed
            # Original: student -> teacher
            # Reply: teacher -> student
            new_sender_id = replier_id
            new_receiver_id = original_sender_id

            Logger.info("""
            [REPLY EMAIL]
            Parent Message: #{parent_id}
            Original: #{original_sender_id} -> #{original_receiver_id}
            Reply: #{new_sender_id} -> #{new_receiver_id}
            Replier: #{replier_id}
            """)

            changeset
            |> Ash.Changeset.change_attribute(:sender_user_id, new_sender_id)
            |> Ash.Changeset.change_attribute(:receiver_user_id, new_receiver_id)

          {:error, reason} ->
            Logger.error("[REPLY EMAIL] Failed to load parent message: #{inspect(reason)}")
            Ash.Changeset.add_error(changeset, :parent_message_id, "parent message not found")
        end
      end)

      # After creating the reply, send the email
      change(fn changeset, context ->
        Ash.Changeset.after_action(changeset, fn _changeset, email_message ->
          Logger.info(
            "[REPLY EMAIL AFTER_ACTION] Starting reply send for message: #{email_message.id}"
          )

          case KgEdu.Email.EmailSender.send_email(email_message, tenant: context.tenant) do
            {:ok, :sent} ->
              Logger.info("[REPLY EMAIL AFTER_ACTION] Reply sent successfully")

              case email_message
                   |> Ash.Changeset.for_update(:mark_as_sent)
                   |> Ash.update(actor: context.actor, authorize?: false, tenant: context.tenant) do
                {:ok, updated_message} ->
                  {:ok, updated_message}

                {:error, update_error} ->
                  Logger.error(
                    "[REPLY EMAIL AFTER_ACTION] Failed to mark as sent: #{inspect(update_error)}"
                  )

                  {:ok, email_message}
              end

            {:error, reason} ->
              Logger.error("[REPLY EMAIL AFTER_ACTION] Failed to send reply: #{inspect(reason)}")

              case email_message
                   |> Ash.Changeset.for_update(:mark_as_failed, %{error_message: inspect(reason)})
                   |> Ash.update(actor: context.actor, authorize?: false, tenant: context.tenant) do
                {:ok, updated_message} ->
                  {:ok, updated_message}

                {:error, update_error} ->
                  Logger.error(
                    "[REPLY EMAIL AFTER_ACTION] Failed to mark as failed: #{inspect(update_error)}"
                  )

                  {:ok, email_message}
              end
          end
        end)
      end)
    end
  end

  policies do
    policy always() do
      authorize_if(always())
    end
  end

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    attribute :subject, :string do
      allow_nil?(false)
      description("Email subject")
      public?(true)
    end

    attribute :body, :string do
      allow_nil?(false)
      description("Email body content")
      public?(true)
    end

    attribute :status, :atom do
      allow_nil?(false)
      default(:pending)
      constraints(one_of: [:pending, :sending, :sent, :failed])
      description("Email delivery status")
      public?(true)
    end

    attribute :read_status, :atom do
      allow_nil?(false)
      default(:unread)
      constraints(one_of: [:unread, :read])
      description("Email read status")
      public?(true)
    end

    attribute :read_at, :utc_datetime do
      allow_nil?(true)
      description("Timestamp when email was read")
      public?(true)
    end

    attribute :error_message, :string do
      allow_nil?(true)
      description("Error message if sending failed")
      public?(true)
    end

    attribute :sent_at, :utc_datetime do
      allow_nil?(true)
      description("Timestamp when email was sent")
      public?(true)
    end

    attribute :failed_at, :utc_datetime do
      allow_nil?(true)
      description("Timestamp when email failed to send")
      public?(true)
    end

    attribute :parent_message_id, :uuid do
      allow_nil?(true)
      description("Parent email message ID for thread/reply tracking")
      public?(true)
    end

    timestamps(public?: true)
  end

  relationships do
    belongs_to :sender, KgEdu.Accounts.User do
      public?(true)
      allow_nil?(false)
      destination_attribute(:id)
      source_attribute(:sender_user_id)
      description("The user who sent the email")
    end

    belongs_to :receiver, KgEdu.Accounts.User do
      public?(true)
      allow_nil?(false)
      destination_attribute(:id)
      source_attribute(:receiver_user_id)
      description("The user who received the email")
    end

    belongs_to :parent_message, __MODULE__ do
      public?(true)
      allow_nil?(true)
      destination_attribute(:id)
      source_attribute(:parent_message_id)
      description("Parent email message for thread/reply tracking")
    end

    has_many :sub_messages, __MODULE__ do
      public?(true)
      destination_attribute(:parent_message_id)
      source_attribute(:id)
      description("Sub-messages (replies) to this email")
    end
  end
end
