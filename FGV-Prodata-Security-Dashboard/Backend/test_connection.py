from database import get_db_connection

try:
    connection = get_db_connection()

    if connection.is_connected():
        print("SUCCESS: Connected to MySQL!")

    connection.close()

except Exception as e:
    print("ERROR:", e)


    