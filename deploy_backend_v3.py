import os
import shutil

# Source directory (cryptoquantx)
source_dir = r"c:\Users\ralph\IdeaProject\cryptoquantx"
# Target directory (okx-trading)
target_base = r"c:\Users\ralph\IdeaProject\okx-trading\src\main\java\com\okx\trading"

# Files to move
files_to_move = [
    ("temp_TelegramChannelDTO.java", "model/dto/TelegramChannelDTO.java"),
    ("temp_TelegramChannelEntity.java", "model/entity/TelegramChannelEntity.java"),
    ("temp_TelegramScraperService.java", "service/impl/TelegramScraperService.java"),
    ("temp_TelegramController.java", "controller/TelegramController.java")
]

def deploy():
    print("Starting deployment...")
    
    for temp_file, rel_path in files_to_move:
        src = os.path.join(source_dir, temp_file)
        dst = os.path.join(target_base, rel_path)
        
        # Create directory if not exists
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        
        if os.path.exists(src):
            try:
                shutil.copy2(src, dst)
                print(f"Deployed: {temp_file} -> {rel_path}")
                # Optional: delete temp file
                # os.remove(src)
            except Exception as e:
                print(f"Error deploying {temp_file}: {e}")
        else:
            print(f"Source file not found: {temp_file}")

    print("Deployment complete.")

if __name__ == "__main__":
    deploy()
