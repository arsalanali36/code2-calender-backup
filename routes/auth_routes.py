from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('page.index'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=True)
            return redirect(url_for('page.index'))
        else:
            flash('Invalid email or password', 'error')

    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('page.index'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not email or not password:
            flash('Email and password are required', 'error')
            return redirect(url_for('auth.register'))
            
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return redirect(url_for('auth.register'))
            
        user_exists = User.query.filter_by(email=email).first()
        if user_exists:
            flash('Email already registered', 'error')
            return redirect(url_for('auth.register'))
            
        new_user = User(email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        # Migrate existing data for the first user
        if new_user.id == 1:
            import os
            import shutil
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            default_trades = os.path.join(base_dir, 'data', 'trades.json')
            user_trades = os.path.join(base_dir, 'data', f'trades_1.json')
            if os.path.exists(default_trades) and not os.path.exists(user_trades):
                try:
                    shutil.copy2(default_trades, user_trades)
                except Exception as e:
                    print(f"Migration error: {e}")

        login_user(new_user, remember=True)
        return redirect(url_for('page.index'))

    return render_template('register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@auth_bp.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if current_user.is_authenticated:
         return redirect(url_for('page.index'))

    if request.method == 'POST':
        email = request.form.get('email')
        new_password = request.form.get('new_password')
        confirm = request.form.get('confirm_password')

        if not email or not new_password:
            flash('Email and new password are required.', 'error')
            return redirect(url_for('auth.reset_password'))

        if new_password != confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('auth.reset_password'))
            
        user = User.query.filter_by(email=email).first()
        if not user:
            flash('Email not found. Please register.', 'error')
            return redirect(url_for('auth.reset_password'))

        user.set_password(new_password)
        db.session.commit()
        
        flash('Password updated successfully. You can now log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('reset_password.html')
