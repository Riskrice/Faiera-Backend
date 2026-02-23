
import { DataSource } from 'typeorm';
import { User } from '../src/modules/auth/entities/user.entity';
import { dataSourceOptions } from '../src/database/data-source';

async function checkUser() {
    const dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();

    const userRepository = dataSource.getRepository(User);
    const user = await userRepository.findOneBy({ email: 'superadmin@faiera.com' });

    if (user) {
        console.log(`User: ${user.email}`);
        console.log(`Role: ${user.role}`);
    } else {
        console.log('User not found');
    }

    await dataSource.destroy();
}

checkUser().catch(console.error);
