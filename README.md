# AI-Powered Adaptive Personal Life Planner

### Intelligent Daily Scheduling, Goal Tracking, and Personalized Lifestyle Management

🌐 **Live Demo:** https://ai-powered-personal-life-planner.onrender.com

📂 **GitHub Repository:** https://github.com/Dharshana1807/AI-Powered-Personal-Life-Planner

## 📌 Project Overview

The **AI-Powered Adaptive Personal Life Planner** is an AI-assisted web application designed to help users organize their daily activities, manage personal goals, and build a balanced lifestyle.

The application brings daily scheduling, study planning, career development, diet and nutrition tracking, fitness planning, habit tracking, and personal journaling into one platform. Its goal is to help users manage their time effectively, improve productivity, and maintain a balance between education, career, health, and personal life.

By integrating Google's Gemini AI, the application can provide personalized suggestions and planning assistance based on user needs and the information supplied.

## 🎯 Objectives

- To simplify daily task management and time scheduling.
- To support personal, academic, career, and lifestyle goal tracking.
- To provide AI-assisted planning and personalized recommendations.
- To encourage healthy habits and balanced daily routines.
- To help users review their activities and monitor progress.

## ✨ Key Features

### 📅 Daily Planner
- Organize daily activities and tasks.
- Create and manage scheduled tasks.
- View daily schedules in one place.
- Track task completion.

### 🤖 AI Assistant
- Provide AI-assisted planning support using Gemini.
- Help users organize priorities and daily activities.
- Offer suggestions based on the information provided.
- Support schedule adjustments where implemented.

### 🎓 Study Planner
- Organize study activities and academic goals.
- Plan learning sessions and revision tasks.
- Support structured study routines.

### 💼 Career Planner
- Organize career-related goals and learning activities.
- Plan skill-development tasks.
- Support preparation for future career opportunities.

### 🥗 Diet and Nutrition
- Organize meal plans and food-related goals.
- Support nutrition tracking where implemented.
- Help users monitor dietary information and progress.

### 💪 Fitness Planner
- Organize fitness activities and personal fitness goals.
- Track planned activities and progress where implemented.

### ✅ Goal and Habit Tracking
- Manage personal goals.
- Track habits and task completion.
- Encourage consistency in daily routines.

### 📔 Journal and Reflection
- Record personal notes and reflections.
- Review progress and daily experiences.

## 🛠️ Technologies Used

The project uses the following technologies, subject to the implementation in the repository:

- **Frontend:** React.js
- **Build Tool:** Vite
- **Backend:** Node.js and Express.js
- **Artificial Intelligence:** Google Gemini API
- **Version Control:** Git and GitHub
- **Deployment:** Render
- **Data Storage:** Browser storage or server-side storage, depending on the configured implementation

## 🏗️ System Architecture

The application follows a web-based architecture in which the user interacts with the frontend, the application communicates with the backend where configured, and the backend connects to the Gemini API for AI-assisted features.

```text
              User
                |
                v
        React Web Interface
                |
                v
       Node.js / Express API
                |
          +-----+-----+
          |           |
          v           v
     Gemini API   Data Storage
          |           |
          +-----+-----+
                |
                v
       Personalized Assistance
```

*The diagram represents the intended architecture. Adapt it if the deployed application uses a different data flow.*

## 🚀 Live Application

The application is deployed on Render.

**Open the application:**  
https://ai-powered-personal-life-planner.onrender.com

The live version allows users to access the deployed application through a web browser. Availability of individual features depends on the current deployment configuration.

## 💻 Run the Project Locally

### Prerequisites

- Node.js and npm
- Git
- A Google Gemini API key for AI features

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/Dharshana1807/AI-Powered-Personal-Life-Planner.git
```

**2. Navigate to the project directory**

```bash
cd AI-Powered-Personal-Life-Planner
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a `.env` file in the appropriate backend or project directory, according to the server configuration.

```env
GEMINI_API_KEY=your_gemini_api_key
```

Replace the placeholder with your own API key. Never commit the `.env` file or expose the key in frontend code.

**5. Start the application**

Use the command supported by your project's `package.json`. For example, if the corresponding scripts exist:

```bash
npm run dev
```

For production builds, use the project's configured build and start scripts.

## ☁️ Deployment

The application is hosted on Render and linked to its GitHub repository.

The deployment process may include:

1. Connecting the GitHub repository to Render.
2. Configuring the appropriate Node.js build and start commands.
3. Adding required environment variables securely.
4. Building and starting the application.
5. Accessing the deployed application through its Render URL.

## 🔐 Security Considerations

- API keys should be stored in server-side environment variables.
- Sensitive credentials must not be committed to the GitHub repository.
- Production authentication and data protection should be implemented before using the application for sensitive personal information.

## 🔮 Future Enhancements

- Improved adaptive scheduling and conflict detection.
- Personalized AI recommendations across planner modules.
- Enhanced nutrition information and meal tracking.
- Calendar integration and configurable reminders.
- Detailed weekly and monthly progress reports.
- Secure user accounts and cross-device synchronization.
- Mobile-friendly improvements and data export options.

## 🎓 Project Purpose

This project demonstrates the application of artificial intelligence and web development to personal productivity and lifestyle management. It aims to bring multiple planning activities together in one accessible application.

## 👩‍💻 Repository

**Project Name:** AI-Powered Adaptive Personal Life Planner

**Repository:** https://github.com/Dharshana1807/AI-Powered-Personal-Life-Planner

**Live Application:** https://ai-powered-personal-life-planner.onrender.com

---

*Developed as an academic project focused on AI-assisted scheduling, personal productivity, and lifestyle planning.*

