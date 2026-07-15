# Application Description

I’m building this super-apps to keep track things that I need in my day-to-day life. I made this app in order to not have to pay for subscription regarding this basic task. I think it’s going to be cheaper in the long run.

# Features

The main features of this app would be:

* Home  
  Shortcuts to some of the functionalities and access to the menu.   
* Spending Tracking   
  Keep track of what I spend in a day. I want it to have AI capabilities where I could just insert a photo and it would autofill the inputs.  
* Money Log  
  This feature is quite different than the spending logger. I could input all of the money I have from all of my accounts. I could add this periodically.   
* Pomodoro Timer  
  Keep track of my focus time with pomodoro. The feature would be the same as https://pomofocus.io/. It would have short break, long break, pause, monitor, and report. There would also be projects that I could select that I’m working on while the timer is running.  
* Personal CRM (for friends, not customer)  
  Tools for noting down friends and their information, Those informations include name, description, photos, contacts.  
* Task Management  
  Tools for keeping track of my tasks. I could add tasks, description, tag it into some projects or just tags. It would also have deadline where I could be notified via email before the deadline hits.   
* Notes  
  Feature for taking personal notes. The notes feature would be similar to obsidian. It would use markdown for the writing and format. It could also be assigned to projects or tags. Could also attach photos. This notes feature could have AI features too to generate the notes.   
* Events  
  To keeping track of event that take place. This event could be meetups, calls, hangouts, etc. Could tag friend from the CRM tools. Could also attach photos and locations.  
* Habit Tracker  
  I could create a habit and then log it if I do it. There will be tracking per month and weeks. There will be also statistics for it.

# Technical Design

## Development and Deployment

The system will be made in React and Hono and will be deployed using Cloudflare service.

## Email Notification

Will be send using in-system mailing service using nodemailer. Need to make the sender to be whitelisted first.

## AI Features

Will be using deepseek for the AI features. Will buy $20 token and see how much it would last. 

## Database

Will be using D1 database and prism for the database syntax.
