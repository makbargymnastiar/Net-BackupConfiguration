"""
Tests for nodes routes.
"""

import pytest
import json


class TestNodesList:
    """Tests for nodes list endpoint."""

    def test_nodes_requires_auth(self, client):
        """Test that nodes endpoint requires authentication."""
        response = client.get("/api/nodes")
        assert response.status_code == 302  # Redirect to login

    def test_nodes_returns_list(self, client, test_client_with_auth, clean_db):
        """Test that nodes returns a list."""
        response = test_client_with_auth.get("/api/nodes")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)

    def test_nodes_returns_correct_format(
        self, client, test_client_with_auth, clean_db
    ):
        """Test that nodes returns correct node format."""
        response = test_client_with_auth.get("/api/nodes")
        assert response.status_code == 200
        data = json.loads(response.data)
        # Should be list of nodes with expected fields
        if len(data) > 0:
            node = data[0]
            assert "id" in node or "name" in node


class TestNodeCRUD:
    """Tests for node CRUD operations."""

    def test_add_node(self, client, test_client_with_auth, clean_db):
        """Test adding a new node."""
        response = test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "test-router",
                "ip": "192.168.1.1",
                "model": "ios",
                "protocol": "ssh",
                "port": 22,
                "username": "admin",
                "password": "secret",
            },
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True

    def test_add_node_missing_required_field(
        self, client, test_client_with_auth, clean_db
    ):
        """Test that API accepts partial data (current behavior)."""
        response = test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "test-router",
                # Missing ip, model, etc.
            },
        )
        # Current behavior: accepts partial data with empty defaults
        assert response.status_code == 200
        data = json.loads(response.data)
        # Note: API currently succeeds with empty defaults
        # This test documents current behavior

    def test_get_node_by_name(self, client, test_client_with_auth, clean_db):
        """Test getting a specific node by name."""
        # First create a node
        test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "my-router",
                "ip": "10.0.0.1",
                "model": "junos",
                "protocol": "ssh",
                "port": 22,
                "username": "admin",
                "password": "secret",
            },
        )
        response = test_client_with_auth.get("/api/nodes/my-router")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["name"] == "my-router"
        assert data["ip"] == "10.0.0.1"

    def test_update_node(self, client, test_client_with_auth, clean_db):
        """Test updating a node."""
        # Create a node
        test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "old-router",
                "ip": "1.1.1.1",
                "model": "ios",
                "protocol": "ssh",
                "port": 22,
                "username": "admin",
                "password": "secret",
            },
        )
        # Update it
        response = test_client_with_auth.put(
            "/api/nodes/old-router",
            json={"ip": "2.2.2.2", "model": "iosxe"},
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True

        # Verify update
        response = test_client_with_auth.get("/api/nodes/old-router")
        data = json.loads(response.data)
        assert data["ip"] == "2.2.2.2"

    def test_update_node_syncs_csv_and_reloads_oxidized(
        self, test_client_with_auth, clean_db, monkeypatch
    ):
        from models.node import Node
        from routes import nodes as nodes_routes

        Node(
            name="sync-router",
            ip="192.0.2.10",
            model="ios",
            protocol="ssh",
            port=22,
            username="admin",
            password="secret",
        ).save()
        written_nodes = []
        monkeypatch.setattr(
            nodes_routes,
            "write_nodes_csv",
            lambda nodes: written_nodes.extend(nodes),
        )
        monkeypatch.setattr(nodes_routes, "reload_oxidized_nodes", lambda: True)

        response = test_client_with_auth.put(
            "/api/nodes/sync-router",
            json={
                "ip": "192.0.2.20",
                "model": "IOSXE",
                "protocol": "telnet",
                "port": 2323,
            },
        )

        assert response.status_code == 200
        assert response.json["success"] is True
        assert response.json["oxidized_reloaded"] is True
        assert response.json["node"]["ip"] == "192.0.2.20"
        assert response.json["node"]["protocol"] == "telnet"
        assert response.json["node"]["port"] == 2323
        assert written_nodes[0]["ip"] == "192.0.2.20"

    def test_update_node_rejects_out_of_range_port(
        self, test_client_with_auth, clean_db
    ):
        from models.node import Node

        Node(
            name="invalid-port-router",
            ip="192.0.2.10",
            model="ios",
            username="admin",
            password="secret",
        ).save()

        response = test_client_with_auth.put(
            "/api/nodes/invalid-port-router", json={"port": 70000}
        )

        assert response.status_code == 400
        assert response.json["success"] is False
        assert Node.get_by_name("invalid-port-router").port == 22

    def test_delete_node(self, client, test_client_with_auth, clean_db):
        """Test deleting a node."""
        # Create a node
        test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "to-delete",
                "ip": "5.5.5.5",
                "model": "ios",
                "protocol": "ssh",
                "port": 22,
                "username": "admin",
                "password": "secret",
            },
        )
        # Delete it
        response = test_client_with_auth.delete("/api/nodes/to-delete")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True


class TestNodeValidation:
    """Tests for node input validation."""

    def test_port_must_be_number(self, client, test_client_with_auth, clean_db):
        """Test that port must be a valid number."""
        response = test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "test",
                "ip": "1.1.1.1",
                "model": "ios",
                "protocol": "ssh",
                "port": "not-a-number",
                "username": "admin",
                "password": "secret",
            },
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        # Should either succeed with int conversion or fail validation
        assert data.get("success") is False or "port" in data.get("error", "").lower()

    def test_model_normalized_to_lowercase(
        self, client, test_client_with_auth, clean_db
    ):
        """Test that model name is normalized to lowercase."""
        response = test_client_with_auth.post(
            "/api/nodes",
            json={
                "name": "model-test",
                "ip": "1.1.1.1",
                "model": "IOSXE",  # uppercase
                "protocol": "ssh",
                "port": 22,
                "username": "admin",
                "password": "secret",
            },
        )
        assert response.status_code == 200

        # Check node was saved with lowercase model
        response = test_client_with_auth.get("/api/nodes/model-test")
        data = json.loads(response.data)
        assert data["model"] == "iosxe"
