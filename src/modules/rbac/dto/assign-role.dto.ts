import { IsNotEmpty, IsUUID, ValidateIf } from 'class-validator';

export class AssignRoleDto {
    @ValidateIf((dto: AssignRoleDto) => !dto.adminId)
    @IsUUID('all', { message: 'معرف المستخدم غير صحيح' })
    @IsNotEmpty()
    userId?: string;

    // Legacy alias expected by old frontend payloads.
    @ValidateIf((dto: AssignRoleDto) => !dto.userId)
    @IsUUID('all', { message: 'معرف المشرف غير صحيح' })
    @IsNotEmpty()
    adminId?: string;

    @IsUUID('all', { message: 'معرف الدور غير صحيح' })
    @IsNotEmpty()
    roleId!: string;
}
