import axios from 'axios';
import dotenv from 'dotenv';
import config from '../config/blog-configs.json' with { type: "json" };

// Use require for JSON file
// const config = require('./blog-configs.json'); // Adjust the path if necessary

dotenv.config();

const { url, username, password } = config[0].sites[0];
const auth = Buffer.from(`${username}:${password}`).toString('base64');
console.log('url:', url);
console.log("WP_PASSWORD:", password);
console.log("wp_username:", username);


// Upload image helper
async function uploadImage(imageUrl) {
  const imageName = imageUrl.split('/').pop();
  const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageRes.data, 'binary');

  const uploadRes = await axios.post(`${url}/wp-json/wp/v2/media`, imageBuffer, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Disposition': `attachment; filename="${imageName}"`,
      'Content-Type': 'image/jpeg'
    }
  });

  return uploadRes.data.id;
}

// Get or create tag by name
async function getOrCreateTag(tagName) {
  try {
    const searchRes = await axios.get(`${url}/wp-json/wp/v2/tags`, {
      headers: { 'Authorization': `Basic ${auth}` },
      params: { search: tagName }
    });

    if (searchRes.data.length > 0) {
      return searchRes.data[0].id;
    }

    const createRes = await axios.post(`${url}/wp-json/wp/v2/tags`, {
      name: tagName
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return createRes.data.id;

  } catch (err) {
    console.error(`Error getting/creating tag "${tagName}":`, err.response?.data || err.message);
    return null;
  }
}

// Main publishing function
export async function publishToWordPress(blog) {
  const { title, excerpt, tags = [], featuredImage, sections, conclusion } = blog;

  const contentHTML = sections.map(s =>
    `<h2>${s.heading}</h2><p>${s.body}</p>` + (s.image ? `<img src="${s.image}" alt="${s.heading}"/>` : '')
  ).join('') + `<h2>Conclusion</h2><p>${conclusion}</p>`;

  const imageId = featuredImage ? await uploadImage(featuredImage) : null;

  const tagIds = await Promise.all(tags.map(tag => getOrCreateTag(tag)));
  const validTagIds = tagIds.filter(id => id !== null);

  try {
    const postRes = await axios.post(`${url}/wp-json/wp/v2/posts`, {
      title,
      content: contentHTML,
      excerpt,
      status: 'publish',
      tags: validTagIds,
      featured_media: imageId || undefined
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return postRes.data;
  } catch (err) {
    console.error('Error publishing post:', err.response?.data || err.message);
    throw err;
  }
}
