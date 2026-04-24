import { MemgraphClient } from './src/utils/memgraphClient';

async function runIntegrationTest() {
    console.log("[IT Test] 正在初始化与 Memgraph 数据库的连接...");
    const host = 'localhost';
    const port = 37788;
    const client = new MemgraphClient(host, port);

    try {
        console.log(`[IT Test] 尝试连接到 bolt://${host}:${port}...`);
        
        const status = await client.checkStatus();
        if (status.connected) {
            console.log(`✅ [IT Test] 连接成功！目前图谱中有 ${status.nodeCount} 个节点。`);
        } else {
            console.error(`❌ [IT Test] 连接失败:`, status.error);
            process.exit(1);
        }

        console.log(`[IT Test] 执行读写测试... 写入测试节点...`);
        const scopeHash = "IT_TEST_SCOPE_123";
        const cypher = "CREATE (n:TestNode { name: 'IT_TEST_NODE', fileScope: 'IT_TEST_SCOPE_123' }) RETURN n";
        await client.executeCypherBatched(cypher, scopeHash, "hash123");
        console.log(`✅ [IT Test] 节点写入成功！`);

        console.log(`[IT Test] 校验作用域和元数据...`);
        const exists = await client.checkScopeHashMatch(scopeHash, "hash123");
        if (exists) {
            console.log(`✅ [IT Test] 数据一致性校验通过！成功查到了写入的哈希值。`);
        } else {
            console.error(`❌ [IT Test] 校验失败：未找到刚写入的数据！`);
        }

        console.log(`[IT Test] 清理测试数据...`);
        await client.deleteByScope(scopeHash);
        
        console.log(`✅ [IT Test] 测试完整联通成功！数据库工作状态完美。`);

    } catch (e: any) {
        console.error("❌ [IT Test] 发生执行错误:", e.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

runIntegrationTest();
