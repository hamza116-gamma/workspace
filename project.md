# Software Requirements Specification (SRS)
# Small Organization Communication & Collaboration Platform

**Document Version:** 1.3  
**Status:** Baseline Product Specification  
**Product Type:** Internal web-based communication platform  
**Primary Audience:** Small/medium organizations  
**Reference:** UI concept supplied by the product owner  
**Stack Update (v1.1):** Next.js frontend; Node.js + Express backend; MongoDB database; Cloudinary storage; no Redis  
**Scope Update (v1.2):** Slack-parity behaviors for all in-scope features, plus **multi-organization (multi-tenancy)** support. Cross-org federation, SSO, voice/video, apps and AI remain out of scope.
**Scope Update (v1.3):** Huddles (audio + video + screen share) are now **in scope**. Full video conferencing / large voice-calling infrastructure remains out of scope (huddles are P2P, small rooms).

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for an internal communication and collaboration platform.

The platform will provide a focused alternative to large enterprise communication products. It will allow employees and administrators to communicate through channels and direct messages, exchange files, search organizational conversations, receive notifications, and manage members.

The system is intended to be significantly smaller in scope than a full enterprise collaboration platform while preserving the core communication workflows users expect from modern team-chat software.

---

# 2. Scope

## 2.1 In Scope

The initial platform shall provide:

- User authentication
- User profiles
- Role-based access
- Organization membership
- Public channels
- Private channels
- Channel membership
- Real-time messaging
- Direct messaging
- Message editing
- Message deletion
- Replies
- Emoji reactions
- Mentions
- File attachments
- Image/media sharing
- Message search
- Channel search
- Member search
- Notifications
- Unread counts
- Presence/online status
- Typing indicators
- Bookmarks
- Member directory
- Basic administration
- Organization settings
- Audit logging for selected administrative actions
- Responsive web interface
- Light/dark mode
- Multiple organizations (multi-tenancy) with organization switching
- Slack-parity behaviors: message threads, group direct messages,
  message pinning and saved items, do-not-disturb presence, channel
  topics/purposes, and per-channel notification preferences
- Huddles (v1.3): audio/video/screen-share calls inside channels and
  DMs (1:1 + group), P2P over WebRTC, with a live pill / join bar /
  floating bar UI and a summary card in the transcript

## 2.2 Out of Scope for Initial Release

The following are not required for MVP:

- Full video conferencing
- Full voice calling infrastructure
- Enterprise-wide workflow automation
- Advanced AI assistant
- Complex project-management suite
- Enterprise SSO/SAML/SCIM
- Advanced compliance/eDiscovery
- Cross-organization federation (Slack Connect-style shared channels)
- Large-scale public communities
- Complex third-party marketplace
- Enterprise analytics
- Advanced bots
- Full calendar replacement

These may be added in future releases.

---

# 3. User Classes

## 3.1 Organization Administrator

Can:
- Manage organization settings
- Invite users
- Disable users
- Assign roles
- Create/manage channels
- Manage permissions
- Review relevant audit logs
- Configure organization defaults

## 3.2 Standard Member

Can:
- Access permitted channels
- Send/receive messages
- Send direct messages
- Upload permitted files
- React to messages
- Reply to messages
- Search permitted content
- Manage own profile
- Manage own notification preferences

## 3.3 Channel Owner/Moderator

Optional role for a channel.

Can:
- Manage channel members
- Edit channel information
- Pin/bookmark channel content where permitted
- Moderate channel messages according to permissions

---

# 4. Product Goals

The system shall:

1. Make internal communication fast.
2. Reduce reliance on scattered communication tools.
3. Keep organizational conversations searchable.
4. Provide organized channel-based communication.
5. Support private one-to-one communication.
6. Support basic file collaboration.
7. Give administrators control over organizational access.
8. Work well on desktop and mobile browsers.
9. Provide a foundation for future mobile applications.

---

# 5. High-Level System Architecture

```text
                         Client Applications
                                |
                    ┌───────────┴───────────┐
                    │                       │
               Web Browser             Future Mobile
                    │
                    │ HTTPS / WebSocket
                    ▼
       Application Backend (Node.js + Express)
                    |
       ┌────────────┼──────────────┐
       │            │              │
       ▼            ▼              ▼
 Authentication   REST/API     WebSocket (Socket.IO)
       │            │              │
       └────────────┼──────────────┘
                    │
                    │
                    ▼
                 MongoDB
                    │
                    │
                    ▼
        Cloudinary (file/media storage)
```

---

# 6. Functional Requirements

## FR-001 Authentication

The system shall allow users to authenticate securely.

### Requirements

- Login with email/username and password.
- Logout.
- Password reset.
- Password change.
- Session expiration.
- Account lock/disable behavior where required.
- Secure password hashing.
- Authentication failure handling.

### Acceptance Criteria

- Valid credentials create an authenticated session.
- Invalid credentials do not authenticate the user.
- Disabled accounts cannot log in.
- Passwords are never stored in plaintext.

---

# 7. FR-002 User Profile

Users shall have profiles containing:

- Full name
- Email
- Profile image
- Job title
- Department
- Presence/status (ACTIVE, AWAY, DND)
- Optional status emoji + status message, with an optional clear-after time

Users shall be able to edit permitted profile fields. Profiles are global
to the user; membership and role are per organization.

---

# 8. FR-003 Organizations (Multi-Tenancy)

The system shall support multiple organizations (workspaces).

Organization data shall include:

- Organization ID
- Name
- Slug (unique, URL-safe)
- Logo
- Settings / defaults
- Created date
- Status

All users (via membership), channels, conversations, messages, files and
permissions shall belong to an organization. A user may belong to one or
more organizations through an organization membership.

The system shall:

- Allow a user to create an organization (self-serve onboarding).
- Allow organization admins to invite users into their organization.
- Establish an **active organization context** for each authenticated session.
- Allow users who belong to multiple organizations to **switch** the active
  organization without signing out.
- Enforce strict **tenant isolation** on the server for every read and write.

---

# 9. FR-004 User Management

Administrators shall be able to:

- Invite users
- View users
- Search users
- Disable users
- Reactivate users
- Assign roles
- Remove users from the organization where permitted
- Create additional organizations (per account policy)

The system shall prevent unauthorized users from performing administrative
actions. All administrative actions and their effects are **scoped to the
actor's active organization**. A user's role is held per organization, so
the same user may be an Admin in one organization and a Member in another.

---

# 10. FR-005 Channels

The system shall support channels.

Each channel shall contain:

- ID
- Name
- Description
- Type
- Creator
- Created date
- Status

Channel types:

```text
PUBLIC
PRIVATE
```

### Public Channel

Members can discover/join according to organization permissions.

### Private Channel

Only members explicitly granted access can view the channel.

---

# 11. FR-006 Channel Membership

The system shall maintain channel membership.

Membership shall contain:

- Channel ID
- User ID
- Role
- Joined date
- Notification preference

Users shall only access private channel content if they are members or have authorized administrative access.

---

# 12. FR-007 Real-Time Messaging

The system shall provide real-time messaging.

When a user sends a message, authorized connected users should receive it without manually refreshing the page.

Real-time events shall include at minimum:

```text
message.created
message.updated
message.deleted
message.reaction_added
message.reaction_removed
typing.started
typing.stopped
presence.updated
channel.updated
member.added
member.removed
notification.created
```

---

# 13. FR-008 Messages

A message shall contain:

- Message ID
- Conversation/channel ID
- Sender ID
- Content
- Created timestamp
- Updated timestamp
- Deleted timestamp if deleted
- Optional reply-to ID

The system shall support:

- Text
- Mentions
- Emoji
- Links
- Attachments
- Replies
- Reactions

---

# 14. FR-009 Message Editing

Users may edit their own messages subject to organizational policy.

Edited messages shall display an edited indicator.

The system should retain an audit record where required by policy.

---

# 15. FR-010 Message Deletion

Users may delete their own messages where permitted.

Deleted messages should not expose the original content to ordinary users.

Administrative deletion may be supported according to permissions.

---

# 16. FR-011 Threads (Message Replies)

Users shall be able to reply to a message in a thread.

A thread shall maintain a relationship with the parent message.

The interface shall provide a thread side panel showing:

- Parent message
- Reply count displayed on the parent message
- All reply messages
- An option to also send a reply to the channel
- Follow/unfollow the thread, receiving notifications for new replies

---

# 17. FR-012 Reactions

Users shall be able to react to messages.

Minimum reaction support:
- Common emoji reactions
- Add reaction
- Remove own reaction
- Display reaction counts

Example:

```text
👍 4   ❤️ 2   😂 1
```

---

# 18. FR-013 Mentions

Users shall be able to mention members using:

```text
@username
```

The system shall:
- Detect valid mentions
- Provide autocomplete when a user types `@`
- Notify mentioned users
- Highlight mentions in the UI

Supported mention scopes:

```text
@username   -> notify that member
@channel    -> notify all members of the channel
@here       -> notify active/online members of the channel
```

`@channel` and `@here` shall be permitted only for members with the
required permission.

---

# 19. FR-014 Direct Messages

Users shall be able to send one-to-one and group direct messages.

A direct message conversation shall contain:

- Conversation ID
- Participants (two or more)
- Messages
- Read state
- Last activity

Group direct messages (MPDM) shall support three or more participants.

---

# 20. FR-015 Presence

The system shall display a user's approximate availability state.

Initial states:

```text
ACTIVE
AWAY
DND
OFFLINE
```

Users may manually set their presence and configure a do-not-disturb
period. The system shall not expose unnecessary technical information such
as IP addresses to ordinary users.

---

# 21. FR-016 Typing Indicator

When a user is typing in a conversation, other authorized participants may see:

```text
Ahmed is typing...
```

Typing indicators should expire automatically if no typing event is received.

---

# 22. FR-017 File Attachments

Users shall be able to attach files to messages.

The system shall validate:

- File size
- File extension
- MIME type
- User permissions

The system shall store files outside MongoDB in Cloudinary cloud storage.

Messages shall store metadata and a secure file reference.

---

# 23. FR-018 Media

Images and supported media shall display previews.

Users shall be able to:
- Open
- Download where permitted
- View associated message
- View media from channel context panel

---

# 24. FR-019 Search

The system shall provide global search.

Search shall cover content the current user is authorized to access.

Minimum search targets:

- Messages
- Channels
- Users
- Files

Suggested filters:

- Sender
- Channel
- Date
- Has attachment
- Message type

Slack-style query operators (where applicable):

```text
from:<user>
in:<channel>
has:link | has:attachment
before:<date>   after:<date>
```

Security requirement:

> Search results must never expose content from unauthorized private channels, conversations, or other organizations.

---

# 25. FR-020 Pinned Messages & Saved Items

Users shall be able to save messages to a personal, private list
(Slack "Save for later" behavior).

Users shall be able to:
- Save a message
- Remove a saved message
- View saved items

Channels shall support **pinned messages**, visible to all channel members
and managed by members with the required permission.

---

# 26. FR-021 Notifications

The system shall support notifications for:

- Direct and group direct messages
- Mentions
- Thread replies
- Channel activity
- Administrative announcements where applicable

Notifications shall have read/unread state.

The system shall support:

- Per-channel notification preferences: **All activity / Mentions only / Mute**
- A notification center with mark-as-read and mark-all-read
- Do-not-disturb / snooze periods, during which notifications are held

---

# 27. FR-022 Unread Counts

The system shall track unread state for:
- Channels
- Direct messages
- Notifications

Unread counts should update in real time where the user is connected.

---

# 28. FR-023 Draft Messages

The system may save unfinished messages as drafts.

Drafts shall be private to the user.

A draft may contain:
- Conversation ID
- Text
- Optional reply target
- Updated timestamp

---

# 29. FR-024 Member Directory

Users shall be able to browse organization members subject to privacy settings.

Directory fields:
- Name
- Avatar
- Department
- Job title
- Presence
- Status

Search shall be available.

---

# 30. FR-025 Channel Details

The channel context panel shall provide:

- Channel name
- Description
- Member count
- Member list
- Add member action
- Media/files
- Channel actions

---

# 31. FR-026 Administration

The administration area shall support:

### Organization
- Name
- Slug
- Logo
- Defaults
- Create additional organization
- Members and roles (per organization)

### Members
- Invite
- Disable
- Role assignment

### Channels
- Create
- Edit
- Archive
- Manage membership

### Security
- Session management
- Basic access policies

### Audit
- Administrative events

All administration is scoped to the administrator's organization (tenant).

---

# 32. FR-027 Audit Logs

The system should record security-sensitive administrative actions.

Examples:

```text
USER_INVITED
USER_DISABLED
USER_ROLE_CHANGED
CHANNEL_CREATED
CHANNEL_ARCHIVED
MEMBER_ADDED
MEMBER_REMOVED
ADMIN_SETTING_CHANGED
```

Audit logs should include:
- Event ID
- Actor
- Action
- Target
- Timestamp
- Relevant metadata

---

# 33. FR-028 Theme

The application shall support:

- Light
- Dark
- System preference

Theme preference should be stored per user.

---

# 34. FR-029 Responsive Interface

The web application shall support:

- Desktop
- Tablet
- Mobile browser

Desktop uses the four-zone layout.

Tablet collapses secondary navigation.

Mobile uses drawers/sheets and a single primary content panel.

---

# 35. FR-030 Error Handling

The system shall show meaningful errors.

Examples:

```text
Unable to send message.
[Retry]

Upload failed.
File size exceeds the allowed limit.

You do not have permission to access this channel.
```

Do not expose internal stack traces to users.

---

# 36. FR-031 Offline/Reconnection

The client should detect temporary connection loss.

UI example:

```text
Connection lost — reconnecting...
```

After reconnection:
- Re-establish WebSocket connection
- Refresh presence
- Synchronize missed notifications/messages as appropriate
- Retry only operations designed to be safely retried

---

# 37. Permissions

Minimum role model:

```text
Organization Owner
       │
       └── Full control of one organization (settings, members, status)

Organization Admin
       │
       ├── Organization settings
       ├── User management (within the organization)
       └── Channel administration

Channel Moderator
       │
       └── Channel-specific management

Member
       │
       ├── Messages
       ├── Files
       ├── Reactions
       └── Profile
```

Roles are held **per organization**; a user may have different roles in
different organizations. Authorization must be enforced on the server,
scoped to the active organization, not only in the frontend. Every query
and mutation must be constrained by the organization the actor is acting in.

---

# 38. Non-Functional Requirements

## NFR-001 Performance

Normal navigation should feel immediate.

Target:
- Typical API response: under 500 ms under normal deployment conditions
- Message send acknowledgment: ideally under 300 ms on a healthy local network
- Real-time delivery: typically near-instant after server processing

These are engineering targets, not guarantees for poor network conditions.

---

# 39. NFR-002 Scalability

Initial architecture should comfortably support a small organization.

The design should avoid unnecessary microservices.

Recommended initial architecture:

```text
1 Backend Application (Node.js + Express)
1 MongoDB instance/database
1 Cloudinary account (hosted file/media storage)
1 Reverse Proxy
```

Real-time messaging and presence are handled in-process by a single
Socket.IO server instance using in-memory state. Redis is intentionally
not required at this scale; a pub/sub adapter (e.g. Redis or MongoDB
change streams) can be introduced later only if the backend is scaled
to multiple instances. Services can be separated later if growth
requires it.

---

# 40. NFR-003 Security

The platform shall use:

- HTTPS/TLS
- Secure password hashing
- Secure sessions/tokens
- Server-side authorization
- Input validation
- Output encoding
- Rate limiting
- File validation
- Secure cookies where applicable
- Protection against SQL injection
- Protection against XSS
- Appropriate CSRF protections
- Secure secret management
- Database backups

---

# 41. NFR-004 Privacy

Users must only access information for which they have authorization.

Private channels and direct messages must be protected at the API/database authorization layer.

Administrators should only have the access required by defined organizational policies.

---

# 42. NFR-005 Availability

For production deployment, the system should be designed for reliable availability.

Minimum operational practices:
- Automated database backups
- Health checks
- Error logging
- Monitoring
- Disk/storage monitoring
- Recovery procedure

---

# 43. NFR-006 Maintainability

Code should use:
- Modular architecture
- Clear naming
- Type safety where supported
- Automated tests
- API documentation
- Mongoose schema versioning and migration scripts
- Environment-based configuration
- Centralized logging

---

# 44. NFR-007 Accessibility

The application should follow accessibility best practices.

Requirements:
- Keyboard navigation
- Focus states
- Semantic controls
- Screen-reader labels
- Accessible dialogs
- Sufficient contrast
- Reduced-motion support

---

# 45. Suggested Technology Stack

This is a recommended implementation stack, not a mandatory requirement.

## Frontend

```text
Next.js (App Router)
React
TypeScript
Tailwind CSS
Accessible component primitives
Socket.IO client
```

## Backend

```text
Node.js
Express.js
JavaScript (CommonJS)
REST API
Socket.IO (WebSocket) server
```

## Database

```text
MongoDB
Mongoose ODM
```

## Cache/Realtime infrastructure

```text
None required for MVP
(In-process Socket.IO state; Redis may be added later only if
the backend is scaled to multiple instances)
```

## File storage

```text
Cloudinary (images, media, and file attachments)
```

## Deployment

```text
Linux server/container platform
Reverse proxy
HTTPS
Managed or self-hosted MongoDB (e.g. MongoDB Atlas)
```

---

# 46. Proposed Backend Structure (Express)

```text
src/
├── config/            # env, database, Cloudinary setup
├── models/            # Mongoose schemas
│   ├── user.model.js
│   ├── organization.model.js
│   ├── channel.model.js
│   ├── channelMember.model.js
│   ├── conversation.model.js
│   ├── message.model.js
│   ├── reaction.model.js
│   ├── attachment.model.js
│   ├── notification.model.js
│   ├── bookmark.model.js
│   ├── draft.model.js
│   ├── auditLog.model.js
│   └── session.model.js
├── routes/            # Express routers
│   ├── auth.routes.js
│   ├── users.routes.js
│   ├── organizations.routes.js
│   ├── channels.routes.js
│   ├── conversations.routes.js
│   ├── messages.routes.js
│   ├── attachments.routes.js
│   ├── notifications.routes.js
│   ├── search.routes.js
│   ├── bookmarks.routes.js
│   ├── drafts.routes.js
│   └── admin.routes.js
├── controllers/       # Route handlers
├── services/          # Business logic
├── middleware/        # auth, roles, validation, error handling
├── sockets/           # Socket.IO gateways and event handlers
├── utils/             # helpers (mention parsing, hashing, etc.)
├── app.js             # Express app setup
└── server.js          # HTTP server + Socket.IO bootstrap
```

---

# 47. Proposed MongoDB Collections

```text
organizations
organizationMembers
users
channels
channelMembers
conversations            # 1:1 and group DMs
conversationParticipants
messages                 # channel messages, DMs, and thread replies
reactions
attachments
notifications
bookmarks                # saved items
channelPins
drafts
auditLogs
sessions
```

Notes:
- MongoDB is document-based; related data is linked by `ObjectId`
  references (or embedded sub-documents where reads are always combined).
- **Multi-tenancy:** every tenant-owned collection carries an
  `organizationId`, and every query/mutation is scoped by it.
- `organizationMembers` links a user to an organization with a per-org
  role and membership status; it is the source of truth for access.
- `channelMembers` and `conversationParticipants` link users to channels
  and conversations.
- `messages` reference their channel or conversation, sender, optional
  `parentMessageId` (thread), attachments, and reactions.
- Recommended identity policy: a global `User` (unique email) with
  per-organization memberships.
- Indexes: unique `organizations.slug`; unique `(organizationId, channel
  name)`; index `(organizationId, messages.channelId)` and
  `(organizationId, messages.conversationId)`; text indexes scoped for
  search; membership lookups by `organizationId`.

Relationships:

```text
Organization
   │
   ├── OrganizationMembers ── Users
   │
   ├── Channels
   │      └── ChannelMembers ── Users
   │
   └── Conversations (1:1 and group)
          └── Participants ── Users
```

---

# 48. API Requirements

Suggested REST API groups:

```text
/auth
/users
/organizations
/channels
/messages
/conversations
/attachments
/notifications
/search
/bookmarks
/drafts
/admin
```

Example endpoints:

```text
POST   /auth/login
POST   /auth/logout
POST   /auth/password/reset

GET    /users/me
PATCH  /users/me

GET    /channels
POST   /channels
GET    /channels/:id
PATCH  /channels/:id
DELETE /channels/:id

GET    /channels/:id/messages
POST   /channels/:id/messages

PATCH  /messages/:id
DELETE /messages/:id

POST   /messages/:id/reactions
DELETE /messages/:id/reactions/:reaction

GET    /conversations
POST   /conversations
GET    /conversations/:id/messages

GET    /search
GET    /notifications
PATCH  /notifications/:id/read

POST   /organizations
GET    /organizations
GET    /organizations/:id
PATCH  /organizations/:id
POST   /organizations/:id/switch
POST   /organizations/:id/invitations
GET    /organizations/:id/members
PATCH  /organizations/:id/members/:userId
```

---

# 49. WebSocket Contract

The real-time layer should define explicit events.

Client → Server:

```text
message.send
message.edit
message.delete
typing.start
typing.stop
reaction.add
reaction.remove
presence.update
```

Server → Client:

```text
message.created
message.updated
message.deleted
reaction.updated
typing.updated
presence.updated
notification.created
channel.updated
thread.updated
```

All events are scoped to the active organization. A client only receives
events for organizations it belongs to, and authorization context is
resolved server-side before any event is emitted.

Every event should contain:
- Event name
- Event ID where useful
- Entity ID
- Timestamp
- Relevant payload
- Authorization context handled server-side

---

# 50. Core User Flows

## 50.1 Login

```text
Open application
      ↓
Login screen
      ↓
Enter credentials
      ↓
Server validates
      ↓
Create authenticated session
      ↓
Open workspace
```

## 50.2 Send Channel Message

```text
Open channel
      ↓
Enter message
      ↓
Send
      ↓
Server validates authorization
      ↓
Persist message
      ↓
Publish real-time event
      ↓
Recipients receive message
      ↓
Notification/unread state updated
```

## 50.3 Direct Message

```text
Open member
      ↓
Start conversation
      ↓
Send message
      ↓
Persist
      ↓
Real-time delivery
      ↓
Recipient notification
```

## 50.4 File Upload

```text
Select attachment
      ↓
Client validation
      ↓
Upload to Cloudinary
      ↓
Receive Cloudinary secure file reference
      ↓
Create message with attachment metadata
      ↓
Notify recipients
```

---

# 51. UI Screens

Minimum screens:

1. Login
2. Password reset
3. Main workspace
4. Channel
5. Direct message
6. Search
7. Notifications
8. Members
9. Profile
10. Settings
11. Create channel
12. Invite member
13. Channel details
14. Admin dashboard
15. User management
16. Channel management
17. Audit logs
18. Error/permission screens

---

# 52. MVP Definition

The MVP should include:

```text
Authentication
Users
Roles
Organization
Multiple organizations (multi-tenancy) + organization switching
Channels
Private channels
Channel membership
Channel topics and notification preferences
Direct messages
Group direct messages
Real-time messages
Message editing
Message deletion
Threads
Reactions
Mentions (@user, @channel, @here)
File uploads
Notifications
Unread state
Presence (ACTIVE / AWAY / DND / OFFLINE)
Message pinning and saved items
Search
Member directory
Admin basics
Responsive UI
Dark mode
```

The following can wait until after MVP:

```text
Voice
Video
Mobile apps
Advanced analytics
AI
Complex integrations
Enterprise SSO
Advanced workflow automation
```

---

# 53. Testing Requirements

## Unit Testing

Test:
- Authentication
- Authorization
- Message validation
- Channel permissions
- Mention parsing
- Reaction logic
- Notification logic

## Integration Testing

Test:
- Login flow
- Channel creation
- Message persistence
- File upload
- Search authorization
- WebSocket events

## End-to-End Testing

Test:
- User login
- Create channel
- Invite member
- Send message
- Receive real-time message
- Reply
- React
- Upload file
- Search message
- Direct message
- Admin actions

## Security Testing

Test:
- Unauthorized channel access
- Private message access
- Broken access control
- File upload abuse
- Injection
- XSS
- Authentication attacks
- Rate limiting

---

# 54. Acceptance Criteria for MVP

The MVP is considered functionally complete when:

1. Users can securely log in.
2. Users can belong to and switch between multiple organizations.
3. Tenant data is strictly isolated per organization.
4. Administrators can manage organization members.
5. Users can access authorized channels.
6. Users can create/send messages.
7. Messages appear in real time.
8. Users can send 1:1 and group direct messages.
9. Users can start threads, reply, and react.
10. Users can mention members (@user, @channel, @here).
11. Users can upload supported files.
12. Users receive notifications, with per-channel preferences and DND.
13. Users can search authorized content.
14. Users can pin and save messages.
15. Private channel content is protected.
16. The application works on desktop and mobile browser widths.
17. Administrators can manage core organization settings.
18. Automated tests cover critical authentication and authorization paths.
19. Database backups are configured for production.

---

# 55. Future Roadmap

## Version 1.1
- Improved search UX and saved searches
- Better file management and a media/file browser
- Rich text formatting and code blocks
- Custom emoji and user groups (@group)
- Message reminders and scheduled send

## Version 1.2
- Mobile applications
- Push notifications
- Calendar integration
- Task integration

## Version 2.0
- Cross-organization federation (Slack Connect-style shared channels)
- Voice/video
- Advanced integrations
- Workflow automation
- AI-assisted search/summaries
- Advanced administration

---

# 56. Product Success Criteria

The system should make the following common workflow possible without leaving the platform:

```text
Find colleague
      ↓
Open channel/DM
      ↓
Send message
      ↓
Share file
      ↓
Receive reply
      ↓
React/mention
      ↓
Search conversation later
```

The product should remain intentionally focused: reliable communication and collaboration for one organization rather than attempting to replicate every feature of a large enterprise platform.

---

# 57. Final Product Vision

The final platform should feel like a professional internal workspace:

```text
┌─────────────────────────────────────────────────────────────┐
│ Organization + switcher                                      │
├──────────────┬───────────────┬──────────────────┬──────────┤
│ Global       │ Communication │ Conversation     │ Context  │
│ Navigation   │ Navigation    │                 │          │
│              │               │ # Development  │ Members  │
│ Dashboard    │ Search        │                 │          │
│ Tasks        │ Mentions      │ Messages        │ Details  │
│ Projects     │ Drafts        │                 │          │
│ Calendar     │ Bookmarks     │ Attachments     │ Media    │
│ Messages     │ Channels      │                 │          │
│ Members      │ DMs           │ Composer        │          │
│ Settings     │               │                 │          │
└──────────────┴───────────────┴──────────────────┴──────────┘
```

The design should be clean, responsive, accessible, secure, and implementation-friendly.

---

# 58. Implementation Plan (Chosen Stack)

> The authoritative, detailed phase plan is `phases.txt` (v2.0), which
> reflects Slack-parity behavior and multi-tenancy. The summary below is
> kept in sync at a high level.

## Stack Summary

```text
Frontend : Next.js (App Router) + React + TypeScript + Tailwind CSS + Socket.IO client
Backend  : Node.js + Express + JavaScript (CommonJS) + Socket.IO
Database : MongoDB + Mongoose
Storage  : Cloudinary
Realtime : Single Socket.IO server with in-memory state (no Redis)
Deploy   : Linux/container + reverse proxy + HTTPS + managed MongoDB
Tenancy  : Multi-organization (multi-tenancy)
```

## Phase 0 — Project Setup (DONE)

- Two separate projects: `backend/` (Node.js + Express, JavaScript) and
  `frontend/` (Next.js + TypeScript). No monorepo / workspaces.
- ESLint, Prettier, and environment config (`.env`).
- Express app (`app.js`) + server (`server.js`) with Socket.IO bootstrap.
- MongoDB via Mongoose with a health check; Cloudinary SDK configured.

## Phase 1 — Auth, Profiles & Presence Fields (DONE)

- `User` and `Session` Mongoose models.
- scrypt password hashing; signed HttpOnly cookie sessions.
- Login, logout, password reset/change, register-first-admin.
- Server-side auth middleware (`requireAuth`); profile endpoints
  (`GET/PATCH /users/me`) with avatar via Cloudinary signed upload.
- Presence fields ACTIVE / AWAY / DND / OFFLINE and status emoji +
  clear-after (presence driven by Socket.IO from Phase 4).

## Phase 2 — Organizations, Multi-Tenancy, Roles & User Management

- `Organization` model and settings.
- Role model: Organization Admin, Channel Moderator, Member.
- User management: invite, disable, reactivate, assign roles.

## Phase 3 — Channels & Membership

- `Channel` and `ChannelMember` models (public/private).
- Channel CRUD, join/leave, membership and notification preferences.
- Server-side access checks for private channels.

## Phase 4 — Messaging & Realtime

- `Conversation` and `Message` models (channels + DMs).
- REST: list/send/edit/delete messages, replies.
- Socket.IO events: `message.created/updated/deleted`, typing, presence.
- In-memory presence and typing state with expiry; single-instance deployment.

## Phase 5 — Reactions, Mentions, Attachments

- `Reaction` model and add/remove/count logic.
- Mention parsing (`@username`, optional `@channel`) and notification hooks.
- `Attachment` model; upload to Cloudinary, store secure reference + metadata.
- Validate file size, extension, MIME type, and permissions.

## Phase 6 — Notifications, Unread, Search, Bookmarks, Drafts

- `Notification`, `Bookmark`, `Draft` models.
- Unread counts per channel/DM/notification, real-time updates.
- Global search (messages, channels, users, files) via MongoDB text indexes,
  always scoped to what the user is authorized to access.

## Phase 7 — Admin & Audit

- `AuditLog` model; record administrative actions.
- Admin area: organization, members, channels, security/sessions.

## Phase 8 — Frontend

- Four-zone workspace layout; responsive drawers/sheets for mobile.
- Light/dark/system theme stored per user.
- Screens: login, password reset, workspace, channel, DM, search,
  notifications, members, profile, settings, create channel, invite,
  channel details, admin dashboard, audit logs, error screens.

## Phase 9 — Testing & Deployment

- Unit: auth, authorization, message validation, channel permissions,
  mention parsing, reactions, notifications.
- Integration: login, channel creation, message persistence, Cloudinary
  upload, search authorization, Socket.IO events.
- E2E and security tests per Section 53.
- Deploy: reverse proxy + HTTPS, managed MongoDB (e.g. Atlas), automated
  backups, health checks, logging, monitoring.

## Scalability Note

The MVP runs as a single backend instance with MongoDB and Cloudinary,
and no Redis. If the backend is later scaled to multiple instances, add a
Socket.IO pub/sub adapter (Redis) and a shared presence store; the API and
data model do not otherwise change.

---

# 59. Multi-Tenancy & Isolation Model

The platform supports multiple organizations on shared infrastructure.

## Principles

- A `User` has a global identity (unique email, credentials, profile).
- Access to an organization is granted through an `OrganizationMember`
  record carrying a per-organization `role` and `status`.
- Every authenticated session has an **active organization**.
- Every tenant-owned document carries `organizationId`.

## Enforcement

- Authentication resolves the user; **authorization resolves the
  organization membership** for the requested resource.
- Every read and write is filtered by the active `organizationId` at the
  service/data layer. Missing this filter is a security defect.
- Socket.IO emits only within the active organization's rooms.
- Cloudinary assets are namespaced by organization.
- Search indexes and queries are always constrained to organizations the
  user belongs to and channels/conversations they can access.

## Switching

- Users may switch the active organization; the session records the
  selection and all subsequent requests/events use it.
- Users with no organization membership are routed to onboarding.

## Out of scope (v1.2)

- Cross-organization shared channels / external guests (federation).
- Enterprise SSO/SAML/SCIM and directory sync.

---

# 60. Slack-Parity Behavior

All in-scope features shall behave to the standard conventions below
(rather than a reduced version).

## Channels
- Types: public / private; join/leave; member management; archive.
- **Topic** and **Purpose** are editable and shown in channel details.
- Per-user, per-channel notification preference: All / Mentions / Mute.
- Unread divider ("new messages since…") and bold unread channel names.

## Messages
- Grouped by author and time; show full timestamps and an edited marker.
- Hover/message actions: edit, delete, copy link, pin, save, reply in thread.
- Deleted messages hidden from ordinary users; admins may remove by policy.

## Threads
- Thread side panel; reply count on parent; also-send-to-channel option;
  follow/unfollow; thread reply notifications.

## Mentions
- `@user`, `@channel`, `@here`; `@`-autocomplete; highlight; notify.
- `@channel`/`@here` gated by permission.

## Reactions
- Common emoji set; add/remove own; counts; "who reacted" details.

## Direct messages
- 1:1 and **group DMs**; participant avatars; last activity; read state.

## Presence & status
- ACTIVE / AWAY / DND / OFFLINE; manual override; DND/snooze period.
- Profile status emoji + message with optional clear-after.

## Search
- Global search across messages, channels, users, files, always scoped.
- Slack-style operators: `from:`, `in:`, `has:`, `before:`, `after:`.

## Notifications & unread
- Notification center; per-channel preferences; mark read / all read.
- DND holds notifications; unread badges update in real time.

## Files & media
- Upload with size/MIME/extension validation; inline previews; download.
- Media/file browser in the channel context panel; open the source message.

## Pins, saved items, drafts
- Personal saved items; channel pins; auto-saved per-conversation drafts.

## Directory & profiles
- Directory with search; profile card (name, avatar, title, department,
  presence, status).

## Admin & audit
- Org owner/admin roles; invite/disable/reactivate; role assignment;
  channel administration; org settings; audit log of admin actions — all
  scoped to the active organization.

## Shell & theme
- Four-zone layout, org switcher, light/dark/system, responsive
  tablet/mobile drawers, connection-loss banner with reconnect.
