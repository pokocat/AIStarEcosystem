import Link from "next/link";
import { Filter } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { UsersWorkbench } from "@/components/admin/users-workbench";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Users"
        title="平台用户"
        description="统一查看平台用户的角色、套餐、积分余额和账号状态，覆盖附录 B 中的列表页信息结构。"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/users/moderation">
              <Filter data-icon="inline-start" />
              查看封禁记录
            </Link>
          </Button>
        }
      />

      <UsersWorkbench />
    </>
  );
}
