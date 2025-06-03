from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)

# Database setup
DATABASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(DATABASE_DIR, 'comics.db')

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row # Allows accessing columns by name
    return conn

def create_schema():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        volume TEXT,
        publication_years TEXT,
        cover_image_url TEXT
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        issue_number TEXT NOT NULL,
        is_owned BOOLEAN DEFAULT 0,
        title TEXT,
        cover_image_url TEXT,
        release_date TEXT,
        FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
    )
    ''')
    conn.commit()
    conn.close()

def init_db():
    # Creates DB file if it doesn't exist and ensures schema is applied
    conn = get_db_connection() # This will create the file if it doesn't exist
    conn.close()
    create_schema() # Then apply schema

# --- Collection Endpoints ---

@app.route('/collections', methods=['POST'])
def create_collection():
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400

    title = data.get('title')
    volume = data.get('volume')
    publication_years = data.get('publication_years')
    cover_image_url = data.get('cover_image_url')

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO collections (title, volume, publication_years, cover_image_url) VALUES (?, ?, ?, ?)',
            (title, volume, publication_years, cover_image_url)
        )
        collection_id = cursor.lastrowid
        conn.commit()
        new_collection = cursor.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
        return jsonify(dict(new_collection)), 201
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/collections', methods=['GET'])
def get_collections():
    conn = get_db_connection()
    try:
        collections_cursor = conn.execute('SELECT * FROM collections ORDER BY title').fetchall()
        collections_list = [dict(coll_row) for coll_row in collections_cursor]
        return jsonify(collections_list)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/collections/<int:collection_id>', methods=['GET'])
def get_collection_detail(collection_id):
    conn = get_db_connection()
    try:
        collection_row = conn.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
        if collection_row is None:
            return jsonify({'error': 'Collection not found'}), 404

        issues_cursor = conn.execute('SELECT * FROM issues WHERE collection_id = ? ORDER BY issue_number', (collection_id,)).fetchall()
        collection_data = dict(collection_row)
        collection_data['issues'] = [dict(issue_row) for issue_row in issues_cursor]
        return jsonify(collection_data)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/collections/<int:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided for update'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing_collection = cursor.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
        if existing_collection is None:
            return jsonify({'error': 'Collection not found'}), 404

        update_fields = []
        update_values = []

        # Get current values
        current_title = existing_collection['title']
        current_volume = existing_collection['volume']
        current_pub_years = existing_collection['publication_years']
        current_cover_url = existing_collection['cover_image_url']

        # Check each field for update
        if 'title' in data:
            update_fields.append("title = ?")
            update_values.append(data['title'])
        if 'volume' in data:
            update_fields.append("volume = ?")
            update_values.append(data['volume'])
        if 'publication_years' in data:
            update_fields.append("publication_years = ?")
            update_values.append(data['publication_years'])
        if 'cover_image_url' in data:
            update_fields.append("cover_image_url = ?")
            update_values.append(data['cover_image_url'])

        if not update_fields:
            return jsonify({'message': 'No fields to update provided', 'data': dict(existing_collection)}), 200


        query = f"UPDATE collections SET {', '.join(update_fields)} WHERE id = ?"
        update_values.append(collection_id)

        cursor.execute(query, tuple(update_values))
        conn.commit()

        updated_collection = cursor.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
        return jsonify(dict(updated_collection))
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/collections/<int:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing_collection = cursor.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
        if existing_collection is None:
            return jsonify({'error': 'Collection not found'}), 404

        cursor.execute('DELETE FROM collections WHERE id = ?', (collection_id,))
        conn.commit()
        return jsonify({'message': 'Collection deleted successfully'}), 200
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# --- Issue Endpoints ---

@app.route('/collections/<int:collection_id>/issues', methods=['POST'])
def create_issue(collection_id):
    data = request.get_json()
    if not data or not data.get('issue_number'):
        return jsonify({'error': 'Issue number is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if collection exists
        collection_row = cursor.execute('SELECT id FROM collections WHERE id = ?', (collection_id,)).fetchone()
        if collection_row is None:
            return jsonify({'error': 'Collection not found'}), 404

        issue_number = data.get('issue_number')
        is_owned = bool(data.get('is_owned', False)) # Ensure boolean
        title = data.get('title')
        cover_image_url = data.get('cover_image_url')
        release_date = data.get('release_date')

        cursor.execute(
            'INSERT INTO issues (collection_id, issue_number, is_owned, title, cover_image_url, release_date) VALUES (?, ?, ?, ?, ?, ?)',
            (collection_id, issue_number, is_owned, title, cover_image_url, release_date)
        )
        issue_id = cursor.lastrowid
        conn.commit()

        new_issue = cursor.execute('SELECT * FROM issues WHERE id = ?', (issue_id,)).fetchone()
        return jsonify(dict(new_issue)), 201
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/issues/<int:issue_id>', methods=['GET'])
def get_issue_detail(issue_id):
    conn = get_db_connection()
    try:
        issue_row = conn.execute('SELECT * FROM issues WHERE id = ?', (issue_id,)).fetchone()
        if issue_row is None:
            return jsonify({'error': 'Issue not found'}), 404
        return jsonify(dict(issue_row))
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/issues/<int:issue_id>', methods=['PUT'])
def update_issue(issue_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided for update'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing_issue = cursor.execute('SELECT * FROM issues WHERE id = ?', (issue_id,)).fetchone()
        if existing_issue is None:
            return jsonify({'error': 'Issue not found'}), 404

        update_fields = []
        update_values = []

        if 'issue_number' in data:
            update_fields.append("issue_number = ?")
            update_values.append(data['issue_number'])
        if 'is_owned' in data: # Allow updating ownership status
            update_fields.append("is_owned = ?")
            update_values.append(bool(data['is_owned']))
        if 'title' in data:
            update_fields.append("title = ?")
            update_values.append(data['title'])
        if 'cover_image_url' in data:
            update_fields.append("cover_image_url = ?")
            update_values.append(data['cover_image_url'])
        if 'release_date' in data:
            update_fields.append("release_date = ?")
            update_values.append(data['release_date'])
        # collection_id is not typically updated for an existing issue this way

        if not update_fields:
             return jsonify({'message': 'No fields to update provided', 'data': dict(existing_issue)}), 200

        query = f"UPDATE issues SET {', '.join(update_fields)} WHERE id = ?"
        update_values.append(issue_id)

        cursor.execute(query, tuple(update_values))
        conn.commit()

        updated_issue = cursor.execute('SELECT * FROM issues WHERE id = ?', (issue_id,)).fetchone()
        return jsonify(dict(updated_issue))
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/issues/<int:issue_id>', methods=['DELETE'])
def delete_issue(issue_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing_issue = cursor.execute('SELECT * FROM issues WHERE id = ?', (issue_id,)).fetchone()
        if existing_issue is None:
            return jsonify({'error': 'Issue not found'}), 404

        cursor.execute('DELETE FROM issues WHERE id = ?', (issue_id,))
        conn.commit()
        return jsonify({'message': 'Issue deleted successfully'}), 200
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# --- Basic App Route ---
@app.route('/')
def hello():
    return "Backend for Comic Collection App is running!"

if __name__ == '__main__':
    init_db()
    # To run the app for testing:
    # app.run(debug=True, host='0.0.0.0', port=5000)
    print("Database initialization complete. Full API Endpoints for Collections & Issues are defined.")
    print("To run the server, uncomment app.run(...) in __main__ and run: python app.py")
