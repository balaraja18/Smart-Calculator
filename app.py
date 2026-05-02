from flask import Flask, request, jsonify, send_from_directory, after_this_request
import sqlite3
import os
import math
import re
from datetime import datetime

app = Flask(__name__, static_folder='../frontend', static_url_path='')

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path=''):
    return '', 204

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'calculator.db')

# ── Database setup ──────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS history (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                expression TEXT    NOT NULL,
                result     TEXT    NOT NULL,
                timestamp  TEXT    NOT NULL
            )
        ''')
        conn.commit()

# ── Safe expression evaluator ────────────────────────────────────────────────
SAFE_NAMES = {k: v for k, v in math.__dict__.items() if not k.startswith('_')}
SAFE_NAMES.update({'abs': abs, 'round': round, 'min': min, 'max': max})

def safe_eval(expr: str):
    """Evaluate a mathematical expression safely."""
    # Replace common notations
    expr = expr.replace('^', '**')
    expr = expr.replace('×', '*')
    expr = expr.replace('÷', '/')
    expr = expr.replace('π', str(math.pi))
    expr = expr.replace('e', str(math.e))

    # Block dangerous tokens
    if re.search(r'(import|exec|eval|open|os|sys|__)', expr):
        raise ValueError("Unsafe expression")

    result = eval(expr, {"__builtins__": {}}, SAFE_NAMES)
    return result

# ── Routes ───────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.get_json()
    expression = data.get('expression', '').strip()
    if not expression:
        return jsonify({'error': 'Empty expression'}), 400

    try:
        result = safe_eval(expression)
        # Format nicely
        if isinstance(result, float):
            if result == int(result) and abs(result) < 1e15:
                result_str = str(int(result))
            else:
                result_str = f"{result:.10g}"
        else:
            result_str = str(result)

        # Save to history
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with get_db() as conn:
            conn.execute(
                'INSERT INTO history (expression, result, timestamp) VALUES (?, ?, ?)',
                (expression, result_str, timestamp)
            )
            conn.commit()

        return jsonify({'result': result_str, 'expression': expression})

    except ZeroDivisionError:
        return jsonify({'error': 'Division by zero'}), 400
    except Exception as e:
        return jsonify({'error': f'Invalid expression: {str(e)}'}), 400


@app.route('/api/history', methods=['GET'])
def get_history():
    limit = request.args.get('limit', 50, type=int)
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM history ORDER BY id DESC LIMIT ?', (limit,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/history', methods=['DELETE'])
def clear_history():
    with get_db() as conn:
        conn.execute('DELETE FROM history')
        conn.commit()
    return jsonify({'message': 'History cleared'})


@app.route('/api/history/<int:history_id>', methods=['DELETE'])
def delete_entry(history_id):
    with get_db() as conn:
        conn.execute('DELETE FROM history WHERE id = ?', (history_id,))
        conn.commit()
    return jsonify({'message': 'Entry deleted'})


@app.route('/api/export', methods=['GET'])
def export_history():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT expression, result, timestamp FROM history ORDER BY id DESC'
        ).fetchall()

    lines = ['Expression,Result,Timestamp']
    for r in rows:
        expr = r['expression'].replace(',', ';')
        lines.append(f'"{expr}","{r["result"]}","{r["timestamp"]}"')

    csv_content = '\n'.join(lines)
    from flask import Response
    return Response(
        csv_content,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=calculator_history.csv'}
    )


if __name__ == '__main__':
    init_db()
    print("🚀  Smart Calculator backend running at http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
