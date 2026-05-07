import { v2 as cloudinary } from 'cloudinary';

// Configuration will be pulled from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryService = {
  /**
   * Uploads an image to Cloudinary
   * @param fileUri Base64 string or file path
   * @param folder Folder name in Cloudinary
   */
  uploadImage: async (fileUri: string, folder: string = 'iballot/profiles') => {
    try {
      const result = await cloudinary.uploader.upload(fileUri, {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'limit' }, // Optimize size
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error: any) {
      console.error('Cloudinary Upload Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to upload image to Cloudinary',
      };
    }
  },

  /**
   * Deletes an image from Cloudinary
   * @param publicId Cloudinary public ID
   */
  deleteImage: async (publicId: string) => {
    try {
      await cloudinary.uploader.destroy(publicId);
      return { success: true };
    } catch (error: any) {
      console.error('Cloudinary Delete Error:', error);
      return { success: false, message: error.message };
    }
  }
};
