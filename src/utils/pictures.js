// utils/pictures.js
import { createId } from "./ids.js";

function manufacturingReadOrderPicture(file) {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Choose JPG, PNG or WebP pictures.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('Each original picture must be under 10 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read ' + file.name + '.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unable to open ' + file.name + '.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, 1280 / Math.max(img.width, img.height)),
            canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({
            id: createId('PHOTO'),
            name: file.name,
            src: canvas.toDataURL('image/jpeg', .78)
          });
        } catch {
          reject(new Error('Unable to prepare ' + file.name + '.'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export { manufacturingReadOrderPicture };
