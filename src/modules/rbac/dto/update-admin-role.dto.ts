import { IsUUID } from 'class-validator';

export class UpdateAdminRoleDto {
  @IsUUID('all', { message: 'معرف الدور غير صحيح' })
  roleId!: string;
}
