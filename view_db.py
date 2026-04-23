# -*- coding: utf-8 -*-
import sqlite3
import os
import sys
from pathlib import Path

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# DB 파일 경로
db_path = Path(__file__).parent / "backend" / "grading.db"

if not db_path.exists():
    print(f"[!] DB 파일을 찾을 수 없습니다: {db_path}")
    exit(1)

# DB 연결
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("[DB] Jupyter Notebook 채점 시스템 - DB 상태")
print("=" * 80)

# 테이블 목록 확인
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"\n[OK] 존재하는 테이블: {[t[0] for t in tables]}\n")

# Users 테이블
print("\n" + "-" * 80)
print("[TABLE] USERS - 사용자 정보")
print("-" * 80)
cursor.execute("SELECT id, username, email, role, created_at FROM users;")
users = cursor.fetchall()
if users:
    print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Role':<15} {'Created':<25}")
    print("-" * 95)
    for user in users:
        print(f"{user['id']:<5} {user['username']:<20} {user['email']:<30} {user['role']:<15} {user['created_at']:<25}")
else:
    print("[!] 사용자 데이터가 없습니다.")

# 비밀번호 해시
print("\n[INFO] 비밀번호 정보 (bcrypt 해시 처리됨):")
cursor.execute("SELECT id, username, hashed_password FROM users;")
users_pwd = cursor.fetchall()
for user in users_pwd:
    print(f"  - {user['username']}: {user['hashed_password'][:30]}...")

# Subjects 테이블
print("\n" + "-" * 80)
print("[TABLE] SUBJECTS - 강의 목록")
print("-" * 80)
cursor.execute("""
    SELECT s.id, s.name, s.code, u.username, s.created_at
    FROM subjects s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.user_id
;""")
subjects = cursor.fetchall()
if subjects:
    print(f"{'ID':<5} {'Subject':<25} {'Code':<15} {'Owner':<20} {'Created':<25}")
    print("-" * 90)
    for subject in subjects:
        print(f"{subject['id']:<5} {subject['name']:<25} {subject['code']:<15} {subject['username']:<20} {subject['created_at']:<25}")
else:
    print("[!] 강의 데이터가 없습니다.")

# Grading Sessions 테이블
print("\n" + "-" * 80)
print("[TABLE] GRADING_SESSIONS_DB - 채점 세션")
print("-" * 80)
cursor.execute("""
    SELECT id, status, progress, total_students, processed_students, created_at
    FROM grading_sessions_db
    ORDER BY created_at DESC
    LIMIT 10
;""")
sessions = cursor.fetchall()
if sessions:
    print(f"{'Session ID':<40} {'Status':<12} {'Progress':<10} {'Students':<12} {'Created':<25}")
    print("-" * 100)
    for session in sessions:
        print(f"{session['id']:<40} {session['status']:<12} {session['progress']:<10} {session['total_students']}/{session['processed_students']:<9} {session['created_at']:<25}")
else:
    print("[!] 채점 세션 데이터가 없습니다.")

conn.close()

print("\n" + "=" * 80)
print("[INFO] 기본 사용자 정보 (main.py의 seed_database 함수)")
print("=" * 80)
print("""
  [1] 교수 1
      username: professor
      password: secret
      email: professor@univ.ac.kr
      role: professor

  [2] 교수 2
      username: prof_kim
      password: Kim2024#
      email: kim.prof@univ.ac.kr
      role: professor

[SECURITY] 비밀번호는 DB에 bcrypt 해시로 저장됩니다.
           - 평문으로 저장되지 않으므로 DB에서 원본을 볼 수 없습니다.
           - 소스코드 main.py:62,69 에 평문 비밀번호가 기록되어 있습니다.
""")
print("=" * 80)
