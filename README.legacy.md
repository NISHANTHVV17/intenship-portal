## student Placement Management System
## Stack
Python + Flask + MySQL + HTML/CSS + Bootstrap

## Setup
1. Install Python 3 and MySQL 8.
2. Open `database.sql` in MySQL Workbench and execute it.
3. Edit `config.py` and replace `YOUR_MYSQL_PASSWORD` with your MySQL root password.
4. PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

5. Open `http://127.0.0.1:5000`

## Admin
Email: `admin@placement.com`
Password: `admin123`

## Workflow
Student registers -> completes profile -> adds skills -> uploads resume -> views eligible jobs -> applies -> tracks status.
Company registers -> posts job -> sets CGPA/department/year -> views applicants -> shortlist/select/reject.
Admin views system statistics, users, jobs and applications.
