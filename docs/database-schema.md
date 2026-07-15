# **Super-App Relational Database Schema**

This document outlines the database schema for the personal super-app, divided into five core modules.

## **1\. Shared Core**

Centralized tables used to categorize items across multiple features (Tasks, Notes, Pomodoro).

### **projects**

Stores high-level projects.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the project. |
| name | VARCHAR(100) | Not Null | Name of the project. |
| description | TEXT | Nullable | Detailed scope or goals. |
| color\_hex | VARCHAR(7) | Nullable | Hex code for UI badge rendering. |
| is\_archived | BOOLEAN | Default False | Soft delete flag for completed projects. |
| created\_at | TIMESTAMP | Default NOW() | Timestamp of project creation. |

### **tags**

Universal tags used to categorize tasks and notes.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the tag. |
| name | VARCHAR(50) | Not Null, Unique | Tag label (e.g., \#urgent, \#ideas). |

## **2\. Finance Module**

Handles spending logs (defaulted to IDR) and money logs for account balances.

### **spending\_logs**

Tracks daily expenses with receipt support.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the transaction. |
| amount | DECIMAL(15, 2\) | Not Null | Cost of the transaction (in IDR). |
| category | VARCHAR(50) | Not Null | Grouping like Food, Transport, or Utilities. |
| spent\_at | TIMESTAMP | Not Null | Date and time the purchase occurred. |
| receipt\_image\_url | VARCHAR(255) | Nullable | File path/URL to the receipt photo. |
| notes | TEXT | Nullable | Extra user-added context. |

### **financial\_accounts**

Stores the list of banks, e-wallets, or cash stashes.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the account. |
| name | VARCHAR(100) | Not Null | Account label (e.g., BCA, GoPay). |
| account\_type | VARCHAR(50) | Not Null | Type such as Bank, E-Wallet, or Cash. |
| is\_active | BOOLEAN | Default True | Flag to hide closed accounts from UI. |

### **money\_logs**

Periodic balance snapshots or categorized income/wealth logs.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the log entry. |
| account\_id | UUID | FK \-\> financial\_accounts(id) | The account being updated. |
| balance | DECIMAL(15, 2\) | Not Null | Amount tracked at log time. |
| category | VARCHAR(50) | Nullable | Category of the balance change or log. |
| logged\_date | DATE | Not Null | Date the log applies to. |
| image\_url | VARCHAR(255) | Nullable | Attachment (e.g., screenshot of balance). |
| notes | TEXT | Nullable | Optional context regarding the log. |

## **3\. Productivity Module**

Handles focus tracking, task management, and Markdown notes.

### **pomodoro\_sessions**

Logs focus and break intervals.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the session. |
| project\_id | UUID | FK \-\> projects(id), Nullable | Project worked on during the timer. |
| session\_type | VARCHAR(20) | Not Null | Must be work, short\_break, or long\_break. |
| start\_time | TIMESTAMP | Not Null | When the timer was initiated. |
| end\_time | TIMESTAMP | Nullable | When the timer finished or was stopped. |
| duration\_mins | INTEGER | Not Null | Target duration in minutes (e.g., 25, 5, 15). |
| was\_completed | BOOLEAN | Default False | True if timer ran to zero without interruption. |

### **tasks**

Core task management with deadline alerts.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the task. |
| title | VARCHAR(200) | Not Null | Short actionable title of the task. |
| description | TEXT | Nullable | Detailed instructions or checklists. |
| project\_id | UUID | FK \-\> projects(id), Nullable | Associated project if applicable. |
| status | VARCHAR(20) | Default 'todo' | Must be todo, in\_progress, or done. |
| due\_date | TIMESTAMP | Nullable | Deadline for task completion. |
| reminder\_sent | BOOLEAN | Default False | Prevents duplicate email notifications. |
| created\_at | TIMESTAMP | Default NOW() | Timestamp of creation. |

### **task\_tags**

Junction table mapping tasks to multiple tags.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| task\_id | UUID | FK \-\> tasks(id) | Reference to the task. |
| tag\_id | UUID | FK \-\> tags(id) | Reference to the tag. |

### **notes**

Obsidian-style note storage with Markdown support.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the note. |
| title | VARCHAR(200) | Not Null | Header title of the note. |
| content\_md | TEXT | Nullable | Raw Markdown body text. |
| project\_id | UUID | FK \-\> projects(id), Nullable | Associated project if applicable. |
| created\_at | TIMESTAMP | Default NOW() | Timestamp of creation. |
| updated\_at | TIMESTAMP | Default NOW() | Automatically updated on edit. |

### **note\_tags**

Junction table mapping notes to multiple tags.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| note\_id | UUID | FK \-\> notes(id) | Reference to the note. |
| tag\_id | UUID | FK \-\> tags(id) | Reference to the tag. |

### **note\_attachments**

Stores photos or diagrams attached to specific notes.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the attachment. |
| note\_id | UUID | FK \-\> notes(id) | The note this image belongs to. |
| file\_url | VARCHAR(255) | Not Null | Path to the stored photo or asset. |
| created\_at | TIMESTAMP | Default NOW() | When the file was uploaded. |

## **4\. Social & Life Module**

Manages personal relationships (CRM) and life events.

### **friends**

Core profile information for personal CRM.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the friend. |
| first\_name | VARCHAR(50) | Not Null | Friend's first name. |
| last\_name | VARCHAR(50) | Nullable | Friend's last name. |
| description | TEXT | Nullable | How you met, birthdays, or general notes. |
| photo\_url | VARCHAR(255) | Nullable | Profile avatar image path. |
| created\_at | TIMESTAMP | Default NOW() | When they were added to your CRM. |

### **friend\_contacts**

Stores multiple contact methods per friend.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the contact method. |
| friend\_id | UUID | FK \-\> friends(id) | The friend this contact belongs to. |
| contact\_type | VARCHAR(50) | Not Null | Platform (e.g., Phone, Email, Instagram). |
| contact\_value | VARCHAR(200) | Not Null | The phone number, handle, or email address. |

### **events**

Logs meetups, hangouts, and calls.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the event. |
| title | VARCHAR(150) | Not Null | Name of the hangout or meetup. |
| description | TEXT | Nullable | Details about what happened or agenda. |
| event\_type | VARCHAR(50) | Not Null | Category like Hangout, Call, or Dinner. |
| location | VARCHAR(200) | Nullable | Physical address or video call link. |
| event\_date | TIMESTAMP | Not Null | Date and time the event takes place. |

### **event\_photos**

Allows attaching multiple photos to a single event.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the photo record. |
| event\_id | UUID | FK \-\> events(id) | The event this photo belongs to. |
| photo\_url | VARCHAR(255) | Not Null | Path or URL to the stored photo. |
| uploaded\_at | TIMESTAMP | Default NOW() | When the photo was uploaded. |

### **event\_attendees**

Junction table linking friends to specific events.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| event\_id | UUID | FK \-\> events(id) | Reference to the event. |
| friend\_id | UUID | FK \-\> friends(id) | Reference to the friend who attended. |

## **5\. Habit Tracker Module**

Tracks daily/weekly habits and historical statistics.

### **habits**

Defines the habits to build or break.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the habit. |
| title | VARCHAR(100) | Not Null | Habit name (e.g., Drink Water, Read 10 mins). |
| description | TEXT | Nullable | Motivation or specific rules. |
| frequency | VARCHAR(20) | Default 'daily' | Target cadence (daily, weekly, or monthly). |
| target\_count | INTEGER | Default 1 | Times to complete per frequency period. |
| color\_hex | VARCHAR(7) | Nullable | UI color for charts and streaks. |
| is\_active | BOOLEAN | Default True | Allows pausing habits. |

### **habit\_logs**

Individual completion records for tracking streaks.

| Column Name | Data Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | Primary Key | Unique identifier for the log entry. |
| habit\_id | UUID | FK \-\> habits(id) | The habit being tracked. |
| logged\_date | DATE | Not Null | The day the habit was performed. |
| count | INTEGER | Default 1 | Value achieved (e.g., 5 glasses of water). |
| notes | VARCHAR(255) | Nullable | Quick note on how it went today. |
