using UnityEngine;

namespace CasaDaBee
{
    public class IsoGridController : MonoBehaviour
    {
        public int width = 8;
        public int height = 8;
        public float tileWidth = 1.18f;
        public float tileHeight = 0.62f;

        public Vector3 GridToWorld(int x, int y, float z = 0f)
        {
            return new Vector3((x - y) * tileWidth * 0.5f, -(x + y) * tileHeight * 0.5f, z);
        }

        public void Build()
        {
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    CreateTile(x, y);
                }
            }
        }

        private void CreateTile(int x, int y)
        {
            var tile = new GameObject("Tile " + x + "," + y);
            tile.transform.SetParent(transform, false);
            tile.transform.localPosition = GridToWorld(x, y);

            var meshFilter = tile.AddComponent<MeshFilter>();
            var meshRenderer = tile.AddComponent<MeshRenderer>();
            meshRenderer.sharedMaterial = new Material(Shader.Find("Sprites/Default"))
            {
                color = (x + y) % 2 == 0 ? new Color(1f, 0.92f, 0.62f) : new Color(1f, 0.86f, 0.45f)
            };
            meshRenderer.sortingOrder = -1000 + x + y;

            var halfW = tileWidth * 0.5f;
            var halfH = tileHeight * 0.5f;
            var mesh = new Mesh();
            mesh.vertices = new[]
            {
                new Vector3(0f, halfH, 0f),
                new Vector3(halfW, 0f, 0f),
                new Vector3(0f, -halfH, 0f),
                new Vector3(-halfW, 0f, 0f),
            };
            mesh.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            mesh.RecalculateBounds();
            meshFilter.sharedMesh = mesh;
        }
    }
}
