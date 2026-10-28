from flask import Flask,render_template,request,redirect,url_for,session,flash,send_from_directory
from werkzeug.security import generate_password_hash,check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
from datetime import date
import os
from database import get_db_connection
app=Flask(__name__);app.secret_key='placement-demo-secret-2026';app.config['UPLOAD_FOLDER']='static/uploads/resumes';os.makedirs(app.config['UPLOAD_FOLDER'],exist_ok=True)
def role(r):
 def dec(f):
  @wraps(f)
  def w(*a,**k):
   if session.get('role')!=r:return redirect(url_for('login'))
   return f(*a,**k)
  return w
 return dec
def admin_init():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute("SELECT id FROM users WHERE email='admin@placement.com'");
 if not q.fetchone():q.execute("INSERT INTO users(name,email,password,role) VALUES(%s,%s,%s,'admin')",('Admin','admin@placement.com',generate_password_hash('admin123')));c.commit()
 q.close();c.close()
@app.route('/')
def home():return render_template('index.html')
@app.route('/register',methods=['GET','POST'])
def register():
 if request.method=='POST':
  n=request.form['name'].strip();e=request.form['email'].strip().lower();p=request.form['password'];r=request.form['role'];c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT id FROM users WHERE email=%s',(e,))
  if q.fetchone():flash('Email already registered','danger');q.close();c.close();return redirect(url_for('register'))
  q.execute('INSERT INTO users(name,email,password,role) VALUES(%s,%s,%s,%s)',(n,e,generate_password_hash(p),r));uid=q.lastrowid
  if r=='student':q.execute('INSERT INTO students(user_id,register_no,department,year) VALUES(%s,%s,%s,%s)',(uid,request.form.get('register_no',''),request.form.get('department',''),request.form.get('year') or None))
  else:q.execute('INSERT INTO companies(user_id,company_name) VALUES(%s,%s)',(uid,request.form.get('company_name') or n))
  c.commit();q.close();c.close();flash('Registration successful','success');return redirect(url_for('login'))
 return render_template('register.html')
@app.route('/login',methods=['GET','POST'])
def login():
 if request.method=='POST':
  c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT * FROM users WHERE email=%s',(request.form['email'].strip().lower(),));u=q.fetchone();q.close();c.close()
  if u and check_password_hash(u['password'],request.form['password']):session.update(user_id=u['id'],name=u['name'],role=u['role']);return redirect(url_for('dashboard'))
  flash('Invalid email or password','danger')
 return render_template('login.html')
@app.route('/logout')
def logout():session.clear();return redirect(url_for('home'))
@app.route('/dashboard')
def dashboard():return redirect(url_for({'student':'student_dashboard','company':'company_dashboard','admin':'admin_dashboard'}[session.get('role','student')]))
@app.route('/student/dashboard')
@role('student')
def student_dashboard():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT * FROM students WHERE user_id=%s',(session['user_id'],));s=q.fetchone();d={}
 for k,sql,args in [('applications','SELECT COUNT(*) c FROM applications WHERE student_id=%s',(s['id'],)),('shortlisted',"SELECT COUNT(*) c FROM applications WHERE student_id=%s AND status='Shortlisted'",(s['id'],)),('selected',"SELECT COUNT(*) c FROM applications WHERE student_id=%s AND status='Selected'",(s['id'],)),('open_jobs',"SELECT COUNT(*) c FROM jobs WHERE status='Open' AND (deadline IS NULL OR deadline>=CURDATE())",())]:q.execute(sql,args);d[k]=q.fetchone()['c']
 q.close();c.close();return render_template('student/dashboard.html',student=s,**d)
@app.route('/student/profile',methods=['GET','POST'])
@role('student')
def student_profile():
 c=get_db_connection();q=c.cursor(dictionary=True)
 if request.method=='POST':
  f=request.form;q.execute('UPDATE users SET name=%s,email=%s WHERE id=%s',(f['name'],f['email'],session['user_id']));q.execute('UPDATE students SET register_no=%s,department=%s,year=%s,cgpa=%s,phone=%s,gender=%s,date_of_birth=%s,address=%s WHERE user_id=%s',(f['register_no'],f['department'],f.get('year') or None,f.get('cgpa') or None,f.get('phone'),f.get('gender'),f.get('date_of_birth') or None,f.get('address'),session['user_id']));c.commit();session['name']=f['name'];flash('Profile updated','success')
 q.execute('SELECT u.name,u.email,s.* FROM users u JOIN students s ON u.id=s.user_id WHERE u.id=%s',(session['user_id'],));s=q.fetchone();q.close();c.close();return render_template('student/profile.html',student=s)
@app.route('/student/skills',methods=['GET','POST'])
@role('student')
def skills():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT id FROM students WHERE user_id=%s',(session['user_id'],));sid=q.fetchone()['id']
 if request.method=='POST':
  try:q.execute('INSERT INTO student_skills(student_id,skill_id) VALUES(%s,%s)',(sid,request.form['skill_id']));c.commit();flash('Skill added','success')
  except:c.rollback();flash('Skill already added','warning')
 q.execute('SELECT * FROM skills ORDER BY skill_name');allskills=q.fetchall();q.execute('SELECT ss.id,sk.skill_name FROM student_skills ss JOIN skills sk ON ss.skill_id=sk.id WHERE ss.student_id=%s',(sid,));mine=q.fetchall();q.close();c.close();return render_template('student/skills.html',skills=allskills,my_skills=mine)
@app.post('/student/skills/delete/<int:i>')
@role('student')
def delskill(i):
 c=get_db_connection();q=c.cursor();q.execute('DELETE ss FROM student_skills ss JOIN students s ON ss.student_id=s.id WHERE ss.id=%s AND s.user_id=%s',(i,session['user_id']));c.commit();q.close();c.close();return redirect(url_for('skills'))
@app.route('/student/resume',methods=['GET','POST'])
@role('student')
def resume():
 c=get_db_connection();q=c.cursor(dictionary=True)
 if request.method=='POST':
  f=request.files.get('resume');ext=(f.filename.rsplit('.',1)[1].lower() if f and '.' in f.filename else '')
  if ext not in {'pdf','doc','docx'}:flash('Only PDF, DOC and DOCX allowed','danger')
  else:
   name=secure_filename(f"student_{session['user_id']}_{f.filename}");f.save(os.path.join(app.config['UPLOAD_FOLDER'],name));q.execute('UPDATE students SET resume=%s WHERE user_id=%s',(name,session['user_id']));c.commit();flash('Resume uploaded','success')
 q.execute('SELECT resume FROM students WHERE user_id=%s',(session['user_id'],));s=q.fetchone();q.close();c.close();return render_template('student/resume.html',student=s)
@app.route('/resume/<path:name>')
def viewresume(name):return send_from_directory(app.config['UPLOAD_FOLDER'],name)
@app.route('/student/jobs')
@role('student')
def jobs():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT * FROM students WHERE user_id=%s',(session['user_id'],));s=q.fetchone();q.execute("""SELECT j.*,c.company_name,EXISTS(SELECT 1 FROM applications a WHERE a.job_id=j.id AND a.student_id=%s) applied,(j.min_cgpa<=COALESCE(%s,0) AND (j.eligible_department='All' OR j.eligible_department=%s) AND (j.eligible_year=0 OR j.eligible_year=%s)) eligible FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='Open' AND (j.deadline IS NULL OR j.deadline>=CURDATE()) ORDER BY j.created_at DESC""",(s['id'],s['cgpa'],s['department'],s['year']));x=q.fetchall();q.close();c.close();return render_template('student/jobs.html',jobs=x)
@app.post('/student/jobs/<int:j>/apply')
@role('student')
def apply(j):
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT * FROM students WHERE user_id=%s',(session['user_id'],));s=q.fetchone();q.execute("SELECT * FROM jobs WHERE id=%s AND status='Open'",(j,));x=q.fetchone()
 ok=x and (not x['deadline'] or x['deadline']>=date.today()) and (s['cgpa'] is not None and s['cgpa']>=x['min_cgpa']) and (x['eligible_department']=='All' or x['eligible_department']==s['department']) and (x['eligible_year']==0 or x['eligible_year']==s['year'])
 if ok:
  try:q.execute('INSERT INTO applications(student_id,job_id) VALUES(%s,%s)',(s['id'],j));c.commit();flash('Application submitted','success')
  except: c.rollback();flash('Already applied','warning')
 else:flash('You do not meet this job eligibility','danger')
 q.close();c.close();return redirect(url_for('jobs'))
@app.route('/student/applications')
@role('student')
def myapps():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute("SELECT a.*,j.job_title,j.location,c.company_name FROM applications a JOIN jobs j ON a.job_id=j.id JOIN companies c ON j.company_id=c.id JOIN students s ON a.student_id=s.id WHERE s.user_id=%s ORDER BY a.applied_at DESC",(session['user_id'],));x=q.fetchall();q.close();c.close();return render_template('student/applications.html',applications=x)
@app.route('/company/dashboard')
@role('company')
def company_dashboard():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT * FROM companies WHERE user_id=%s',(session['user_id'],));co=q.fetchone();d={}
 for k,sql in [('jobs','SELECT COUNT(*) c FROM jobs WHERE company_id=%s'),('open','SELECT COUNT(*) c FROM jobs WHERE company_id=%s AND status="Open"'),('apps','SELECT COUNT(*) c FROM applications a JOIN jobs j ON a.job_id=j.id WHERE j.company_id=%s'),('selected','SELECT COUNT(*) c FROM applications a JOIN jobs j ON a.job_id=j.id WHERE j.company_id=%s AND a.status="Selected"')]:q.execute(sql,(co['id'],));d[k]=q.fetchone()['c']
 q.close();c.close();return render_template('company/dashboard.html',company=co,**d)
@app.route('/company/profile',methods=['GET','POST'])
@role('company')
def company_profile():
 c=get_db_connection();q=c.cursor(dictionary=True)
 if request.method=='POST':f=request.form;q.execute('UPDATE companies SET company_name=%s,phone=%s,website=%s,address=%s WHERE user_id=%s',(f['company_name'],f.get('phone'),f.get('website'),f.get('address'),session['user_id']));c.commit();flash('Profile updated','success')
 q.execute('SELECT c.*,u.email FROM companies c JOIN users u ON c.user_id=u.id WHERE c.user_id=%s',(session['user_id'],));x=q.fetchone();q.close();c.close();return render_template('company/profile.html',company=x)
@app.route('/company/jobs/add',methods=['GET','POST'])
@role('company')
def addjob():
 if request.method=='POST':
  f=request.form;c=get_db_connection();q=c.cursor();q.execute('SELECT id FROM companies WHERE user_id=%s',(session['user_id'],));cid=q.fetchone()[0];q.execute('INSERT INTO jobs(company_id,job_title,description,location,salary,min_cgpa,eligible_department,eligible_year,deadline) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)',(cid,f['job_title'],f.get('description'),f.get('location'),f.get('salary'),f.get('min_cgpa') or 0,f.get('eligible_department') or 'All',f.get('eligible_year') or 0,f.get('deadline') or None));c.commit();q.close();c.close();flash('Job posted','success');return redirect(url_for('company_jobs'))
 return render_template('company/add_job.html')
@app.route('/company/jobs')
@role('company')
def company_jobs():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT j.*,(SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) applicants FROM jobs j JOIN companies c ON j.company_id=c.id WHERE c.user_id=%s ORDER BY j.created_at DESC',(session['user_id'],));x=q.fetchall();q.close();c.close();return render_template('company/jobs.html',jobs=x)
@app.post('/company/jobs/<int:j>/toggle')
@role('company')
def toggle(j):
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT j.status FROM jobs j JOIN companies c ON j.company_id=c.id WHERE j.id=%s AND c.user_id=%s',(j,session['user_id']));x=q.fetchone();
 if x:q.execute('UPDATE jobs SET status=%s WHERE id=%s',('Closed' if x['status']=='Open' else 'Open',j));c.commit()
 q.close();c.close();return redirect(url_for('company_jobs'))
@app.route('/company/applications')
@role('company')
def company_apps():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute("SELECT a.*,u.name,u.email,s.register_no,s.department,s.year,s.cgpa,s.resume,j.job_title FROM applications a JOIN students s ON a.student_id=s.id JOIN users u ON s.user_id=u.id JOIN jobs j ON a.job_id=j.id JOIN companies c ON j.company_id=c.id WHERE c.user_id=%s ORDER BY a.applied_at DESC",(session['user_id'],));x=q.fetchall();q.close();c.close();return render_template('company/applications.html',applications=x)
@app.post('/company/applications/<int:i>/<status>')
@role('company')
def setstatus(i,status):
 if status not in {'Shortlisted','Selected','Rejected'}:return redirect(url_for('company_apps'))
 c=get_db_connection();q=c.cursor();q.execute('UPDATE applications a JOIN jobs j ON a.job_id=j.id JOIN companies c ON j.company_id=c.id SET a.status=%s WHERE a.id=%s AND c.user_id=%s',(status,i,session['user_id']));c.commit();q.close();c.close();return redirect(url_for('company_apps'))
@app.route('/admin/dashboard')
@role('admin')
def admin_dashboard():
 c=get_db_connection();q=c.cursor(dictionary=True);d={}
 for k,s in [('students','SELECT COUNT(*) c FROM students'),('companies','SELECT COUNT(*) c FROM companies'),('jobs','SELECT COUNT(*) c FROM jobs'),('applications','SELECT COUNT(*) c FROM applications'),('selected',"SELECT COUNT(*) c FROM applications WHERE status='Selected'")]:q.execute(s);d[k]=q.fetchone()['c']
 q.execute("SELECT u.name,j.job_title,c.company_name,a.status FROM applications a JOIN students s ON a.student_id=s.id JOIN users u ON s.user_id=u.id JOIN jobs j ON a.job_id=j.id JOIN companies c ON j.company_id=c.id ORDER BY a.applied_at DESC LIMIT 10");r=q.fetchall();q.close();c.close();return render_template('admin/dashboard.html',counts=d,recent=r)
@app.route('/admin/users')
@role('admin')
def admin_users():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT name,email,role,created_at FROM users ORDER BY created_at DESC');x=q.fetchall();q.close();c.close();return render_template('admin/users.html',users=x)
@app.route('/admin/jobs')
@role('admin')
def admin_jobs():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT j.*,c.company_name,(SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) applicants FROM jobs j JOIN companies c ON j.company_id=c.id ORDER BY j.created_at DESC');x=q.fetchall();q.close();c.close();return render_template('admin/jobs.html',jobs=x)
@app.route('/admin/applications')
@role('admin')
def admin_applications():
 c=get_db_connection();q=c.cursor(dictionary=True);q.execute('SELECT a.*,u.name,s.register_no,j.job_title,c.company_name FROM applications a JOIN students s ON a.student_id=s.id JOIN users u ON s.user_id=u.id JOIN jobs j ON a.job_id=j.id JOIN companies c ON j.company_id=c.id ORDER BY a.applied_at DESC');x=q.fetchall();q.close();c.close();return render_template('admin/applications.html',applications=x)
if __name__=='__main__':
 try:admin_init()
 except Exception as e:print('Database initialization:',e)
 app.run(debug=True)
