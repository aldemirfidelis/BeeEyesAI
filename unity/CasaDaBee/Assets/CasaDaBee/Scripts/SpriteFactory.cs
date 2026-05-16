using UnityEngine;

namespace CasaDaBee
{
    public static class SpriteFactory
    {
        public static Sprite Circle(string name, int size, Color fill, Color outline, float outlineWidth = 2f)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.name = name;
            texture.filterMode = FilterMode.Point;

            var center = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
            var radius = size * 0.48f;
            var innerRadius = radius - outlineWidth;

            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var distance = Vector2.Distance(new Vector2(x, y), center);
                    if (distance > radius)
                    {
                        texture.SetPixel(x, y, Color.clear);
                    }
                    else if (distance > innerRadius)
                    {
                        texture.SetPixel(x, y, outline);
                    }
                    else
                    {
                        texture.SetPixel(x, y, fill);
                    }
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }

        public static Sprite Rect(string name, int width, int height, Color fill, Color outline, int outlineWidth = 2)
        {
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            texture.name = name;
            texture.filterMode = FilterMode.Point;

            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var isOutline = x < outlineWidth || y < outlineWidth || x >= width - outlineWidth || y >= height - outlineWidth;
                    texture.SetPixel(x, y, isOutline ? outline : fill);
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), Mathf.Max(width, height));
        }
    }
}
