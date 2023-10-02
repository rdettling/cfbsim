from PIL import Image

def make_square(input_path, output_path):
    # Open the image
    img = Image.open(input_path)
    
    # Calculate the size needed to make the image square
    width, height = img.size
    if width == height:
        img.save(output_path)
        return

    max_dim = max(width, height)
    new_img = Image.new("RGBA", (max_dim, max_dim), (255, 255, 255, 0))  # Assuming you want white transparent background

    # Calculate vertical padding
    y_padding = (max_dim - height) // 2

    # Paste the original image onto the centered of the new image
    new_img.paste(img, (0, y_padding))

    # Save the new square image
    new_img.save(output_path)

# Example usage:
make_square("FCS.png", "path_to_save_square_image.png")
